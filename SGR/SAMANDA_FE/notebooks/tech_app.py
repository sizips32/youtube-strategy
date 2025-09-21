import streamlit as st
import FinanceDataReader as fdr
import pandas as pd
import numpy as np
import plotly.graph_objects as go
from ta.trend import MACD
from ta.momentum import RSIIndicator, StochasticOscillator
from ta.volume import MFIIndicator, OnBalanceVolumeIndicator
from ta.volatility import BollingerBands
from datetime import datetime, timedelta
from typing import Dict, Tuple, Optional

# 페이지 설정
st.set_page_config(
    page_title="주식 분석 및 예측",
    layout="wide",
    page_icon="📈"
)

# 상수 정의
PORT = 8999
DEFAULT_STOCK_CODE = '005930'  # 삼성전자

# 기술적 지표 임계값
RSI_OVERSOLD = 30
RSI_OVERBOUGHT = 70
MFI_OVERSOLD = 20
MFI_OVERBOUGHT = 80
STOCH_OVERSOLD = 20
STOCH_OVERBOUGHT = 80

# 모멘텀 상수
MOMENTUM_MONTHS = 12
MOMENTUM_MIN_DATA = 6

# 색상 팔레트
COLOR_PALETTE = {
    'primary': '#1f77b4',
    'secondary': '#ff7f0e',
    'success': '#2ca02c',
    'danger': '#d62728',
    'warning': '#ff7f0e',
    'gold': '#ffd700',
    'brown': '#8c564b',
    'pink': '#e377c2',
    'purple': '#9467bd',
    'gray': '#7f7f7f'
}

def setup_sidebar() -> Tuple[str, int]:
    """사이드바 설정 및 사용자 입력 처리"""
    st.sidebar.title('📊 주식 분석 설정')

    # 주식 코드 입력
    stock_code = st.sidebar.text_input('🔍 주식 코드를 입력하세요:', DEFAULT_STOCK_CODE)

    # 기간 설정
    period_options = {
        '1년': 365,
        '2년': 730,
        '3년': 1095,
        '5년': 1825,
        '10년': 3650
    }
    selected_period = st.sidebar.selectbox('📅 분석 기간:', list(period_options.keys()), index=1)  # 기본값: 2년
    days = period_options[selected_period]

    # 분석 기간 안내
    st.sidebar.markdown('---')
    st.sidebar.info('💡 **추천**: 12개월 모멘텀 분석을 위해 2년 이상 기간을 권장합니다.')

    return stock_code, days

def add_sidebar_info():
    """사이드바에 기술적 지표 설명 추가"""
    st.sidebar.markdown('---')
    st.sidebar.subheader('📚 기술적 지표 설명')

    indicators_info = {
        '💹 RSI (Relative Strength Index)': {
            'description': '과매수/과매도 구간을 파악하는 모멘텀 지표',
            'buy_signal': f'🟢 **매수 신호**: {RSI_OVERSOLD} 이하 (과매도 구간)',
            'sell_signal': f'🔴 **매도 신호**: {RSI_OVERBOUGHT} 이상 (과매수 구간)'
        },
        '📊 MACD (Moving Average Convergence Divergence)': {
            'description': '단기와 장기 이동평균선의 차이를 이용한 추세 지표',
            'buy_signal': '🟢 **매수 신호**: MACD선이 시그널선을 상향 돌파',
            'sell_signal': '🔴 **매도 신호**: MACD선이 시그널선을 하향 돌파'
        },
        '📏 볼린저 밴드 (Bollinger Bands)': {
            'description': '이동평균선과 표준편차를 이용한 변동성 지표',
            'buy_signal': '🟢 **매수 신호**: 하단밴드 터치 (과매도 가능성)',
            'sell_signal': '🔴 **매도 신호**: 상단밴드 터치 (과매수 가능성)'
        },
        '💰 MFI (Money Flow Index)': {
            'description': '거래량과 가격을 결합한 모멘텀 지표',
            'buy_signal': f'🟢 **매수 신호**: {MFI_OVERSOLD} 이하 (과매도 구간)',
            'sell_signal': f'🔴 **매도 신호**: {MFI_OVERBOUGHT} 이상 (과매수 구간)'
        },
        '📊 OBV (On Balance Volume)': {
            'description': '거래량과 가격 변동의 관계를 보여주는 지표',
            'buy_signal': '🟢 **매수 신호**: 상승 추세',
            'sell_signal': '🔴 **매도 신호**: 하락 추세'
        },
        '📉 스토캐스틱 (Stochastic)': {
            'description': '현재가의 상대적 위치를 파악하는 지표\n- %K(빠른선)와 %D(느린선)으로 구성',
            'buy_signal': f'🟢 **매수 신호**:\n- {STOCH_OVERSOLD} 이하 (과매도 구간)\n- %K가 %D를 상향돌파',
            'sell_signal': f'🔴 **매도 신호**:\n- {STOCH_OVERBOUGHT} 이상 (과매수 구간)\n- %K가 %D를 하향돌파'
        },
        '📈 12개월 모멘텀 (Momentum Analysis)': {
            'description': f'최근 {MOMENTUM_MONTHS}개월 월별 수익률을 분석하여 중장기 추세를 파악\n- 가중치 시스템으로 최근 월 강조\n- 양수 월 비율과 평균 상승률 종합 평가',
            'buy_signal': '🟢 **상승 모멘텀**: 6개월 이상 양수 또는 스코어 45점 이상\n- 매우 강함(75+): 9-12개월 양수\n- 강함(60-74): 7-8개월 양수',
            'sell_signal': '🔴 **하락 모멘텀**: 6개월 미만 양수 또는 스코어 45점 미만\n- 강한 하락(25-): 0-3개월 양수\n- 약한 하락(25-44): 4-5개월 양수'
        }
    }

    for title, info in indicators_info.items():
        with st.sidebar.expander(title):
            st.markdown(f"- {info['description']}\n- {info['buy_signal']}\n- {info['sell_signal']}")


@st.cache_data
def load_stock_data(code: str, days: int) -> Optional[pd.DataFrame]:
    """주식 데이터 로드

    Args:
        code: 주식 코드
        days: 조회 기간 (일)

    Returns:
        주식 데이터 DataFrame
    """
    try:
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        df = fdr.DataReader(code, start_date, end_date)
        return df if not df.empty else None
    except Exception as e:
        st.error(f"데이터 로드 실패: {e}")
        return None

def calculate_momentum_analysis(df: pd.DataFrame) -> pd.DataFrame:
    """
    12개월 모멘텀 분석 계산

    Args:
        df: 주식 데이터 DataFrame

    Returns:
        모멘텀 지표가 추가된 DataFrame
    """
    try:
        # 인덱스가 datetime이 아닌 경우 변환
        if not isinstance(df.index, pd.DatetimeIndex):
            df.index = pd.to_datetime(df.index)

        # 월별 마지막 거래일 데이터 추출 (인덱스 기반) - ME 사용으로 FutureWarning 해결
        df_monthly = df.resample('ME').last()

        # 데이터 길이 검증 완화 - 1개월 이상 데이터만 있으면 분석 시도
        if len(df_monthly) < 1:
            # 데이터가 아예 없는 경우만 기본값 설정
            df['Monthly_Return'] = 0
            df['Momentum_Score'] = 0
            df['Momentum_Signal'] = 'no_data'
            df['Momentum_Strength'] = 0
            df['Recent_Trend'] = 'unknown'
            df['Positive_Months'] = 0
            df['Total_Months'] = 0
            return df

        # 월별 수익률 계산
        df_monthly['Monthly_Return'] = df_monthly['Close'].pct_change() * 100

        # 최근 12개월 데이터만 사용
        recent_12m = df_monthly.tail(12)

        # 최소 조건을 1개월로 완화 - 데이터가 있으면 분석 시도
        if len(recent_12m) < 1:
            df['Monthly_Return'] = 0
            df['Momentum_Score'] = 0
            df['Momentum_Signal'] = 'insufficient_data'
            df['Momentum_Strength'] = 0
            df['Recent_Trend'] = 'unknown'
            df['Positive_Months'] = 0
            df['Total_Months'] = 0
            return df

        # 모멘텀 분석 계산
        monthly_returns = recent_12m['Monthly_Return'].dropna()

        # 데이터 범위 확인 및 예외 처리
        if len(monthly_returns) == 0:
            # 수익률 데이터가 없는 경우
            df['Monthly_Return'] = 0
            df['Momentum_Score'] = 50  # 중립 점수
            df['Momentum_Signal'] = 'neutral'
            df['Momentum_Strength'] = 0
            df['Recent_Trend'] = 'unknown'
            df['Positive_Months'] = 0
            df['Total_Months'] = 0
            return df

        # 1. 기본 양수 월 개수
        positive_months = (monthly_returns > 0).sum()
        total_months = len(monthly_returns)

        # 2. 가중치 시스템 (최근 월일수록 높은 가중치) - 데이터 길이에 따라 조정
        weights = np.linspace(1.0, 2.5, len(monthly_returns))  # 1.0 ~ 2.5 선형 증가

        # 3. 가중 모멘텀 스코어 계산
        positive_weighted = sum(weights[i] for i in range(len(monthly_returns)) if monthly_returns.iloc[i] > 0)
        total_weighted = sum(weights)
        weighted_momentum_score = positive_weighted / total_weighted

        # 4. 모멘텀 강도 (양수 월의 평균 수익률 고려)
        positive_returns = monthly_returns[monthly_returns > 0]
        avg_positive_return = positive_returns.mean() if len(positive_returns) > 0 else 0

        # 5. 최근 3개월 연속 트렌드 분석 (데이터 길이에 따라 조정)
        recent_months = min(3, len(monthly_returns))  # 최대 3개월, 데이터가 적으면 그만큼
        recent_3m = monthly_returns.tail(recent_months)
        recent_positive_count = (recent_3m > 0).sum() if len(recent_3m) > 0 else 0

        # 6. 종합 모멘텀 스코어 (0-100 스케일)
        base_score = (positive_months / total_months) * 100
        weighted_boost = (weighted_momentum_score - 0.5) * 40  # -20 ~ +20 보정
        strength_boost = min(avg_positive_return * 2, 15)  # 최대 +15 보정

        momentum_score = max(0, min(100, base_score + weighted_boost + strength_boost))

        # 7. 모멘텀 신호 분류
        if momentum_score >= 75:
            momentum_signal = 'very_strong_up'
        elif momentum_score >= 60:
            momentum_signal = 'strong_up'
        elif momentum_score >= 45:
            momentum_signal = 'weak_up'
        elif momentum_score >= 25:
            momentum_signal = 'weak_down'
        else:
            momentum_signal = 'strong_down'

        # 8. 최근 트렌드 분석 (데이터 길이에 따라 적응적 판단)
        if recent_months >= 3:  # 3개월 이상 데이터
            if recent_positive_count == 3:
                recent_trend = 'accelerating'
            elif recent_positive_count == 0:
                recent_trend = 'decelerating'
            elif recent_positive_count >= 2:
                recent_trend = 'stable_up'
            else:
                recent_trend = 'stable_down'
        elif recent_months == 2:  # 2개월 데이터
            if recent_positive_count == 2:
                recent_trend = 'stable_up'
            elif recent_positive_count == 0:
                recent_trend = 'stable_down'
            else:
                recent_trend = 'neutral'
        elif recent_months == 1:  # 1개월 데이터
            if recent_positive_count == 1:
                recent_trend = 'neutral_up'
            else:
                recent_trend = 'neutral_down'
        else:  # 데이터 없음
            recent_trend = 'unknown'

        # 원본 데이터에 모멘텀 지표 추가 (forward fill로 모든 행에 동일값 적용)
        df['Monthly_Return'] = df_monthly['Monthly_Return'].reindex(df.index, method='ffill').fillna(0)
        df['Momentum_Score'] = momentum_score
        df['Momentum_Signal'] = momentum_signal
        df['Momentum_Strength'] = avg_positive_return
        df['Recent_Trend'] = recent_trend
        df['Positive_Months'] = positive_months
        df['Total_Months'] = total_months

        return df

    except Exception as e:
        # 오류 발생 시 기본값 설정
        st.error(f"모멘텀 분석 오류: {e}")
        df['Monthly_Return'] = 0
        df['Momentum_Score'] = 0
        df['Momentum_Signal'] = 'error'
        df['Momentum_Strength'] = 0
        df['Recent_Trend'] = 'unknown'
        df['Positive_Months'] = 0
        df['Total_Months'] = 0
        return df

def calculate_technical_indicators(df: pd.DataFrame) -> pd.DataFrame:
    # MACD
    macd = MACD(close=df['Close'])
    df['MACD'] = macd.macd()
    df['MACD_Signal'] = macd.macd_signal()
    
    # RSI
    rsi = RSIIndicator(close=df['Close'])
    df['RSI'] = rsi.rsi()
    
    # Bollinger Bands
    bb = BollingerBands(close=df['Close'])
    df['BB_High'] = bb.bollinger_hband()
    df['BB_Low'] = bb.bollinger_lband()
    df['BB_Mid'] = bb.bollinger_mavg()
    
    # MFI (Money Flow Index)
    mfi = MFIIndicator(high=df['High'], low=df['Low'], close=df['Close'], volume=df['Volume'])
    df['MFI'] = mfi.money_flow_index()
    
    # OBV (On Balance Volume)
    obv = OnBalanceVolumeIndicator(close=df['Close'], volume=df['Volume'])
    df['OBV'] = obv.on_balance_volume()
    
    # Stochastic
    stoch = StochasticOscillator(high=df['High'], low=df['Low'], close=df['Close'])
    df['STOCH_K'] = stoch.stoch()  # Fast %K
    df['STOCH_D'] = stoch.stoch_signal()  # Slow %D

    # 12개월 모멘텀 분석 추가
    df = calculate_momentum_analysis(df)

    return df

def make_investment_decision(df: pd.DataFrame) -> Tuple[float, float, float]:
    """기술적 지표와 모멘텀을 기반으로 투자 결정 확률 계산

    Args:
        df: 기술적 지표와 모멘텀이 포함된 주식 데이터

    Returns:
        (매수확률, 매도확률, 관망확률) 튜플
    """
    last_row = df.iloc[-1]

    # 점수 초기화 (가중치 적용)
    buy_signals = 0.0
    sell_signals = 0.0
    total_weight = 0.0

    # RSI 기반 신호 (가중치: 1.0)
    rsi_weight = 1.0
    if last_row['RSI'] < RSI_OVERSOLD:
        buy_signals += rsi_weight
    elif last_row['RSI'] > RSI_OVERBOUGHT:
        sell_signals += rsi_weight
    total_weight += rsi_weight

    # MACD 기반 신호 (가중치: 1.2)
    macd_weight = 1.2
    if last_row['MACD'] > last_row['MACD_Signal']:
        buy_signals += macd_weight
    else:
        sell_signals += macd_weight
    total_weight += macd_weight

    # 볼린저 밴드 기반 신호 (가중치: 1.0)
    bb_weight = 1.0
    if last_row['Close'] < last_row['BB_Low']:
        buy_signals += bb_weight
    elif last_row['Close'] > last_row['BB_High']:
        sell_signals += bb_weight
    total_weight += bb_weight

    # MFI 기반 신호 (가중치: 0.8)
    mfi_weight = 0.8
    if last_row['MFI'] < MFI_OVERSOLD:
        buy_signals += mfi_weight
    elif last_row['MFI'] > MFI_OVERBOUGHT:
        sell_signals += mfi_weight
    total_weight += mfi_weight

    # Stochastic 기반 신호 (가중치: 0.9)
    stoch_weight = 0.9
    if last_row['STOCH_K'] < STOCH_OVERSOLD and last_row['STOCH_K'] > last_row['STOCH_D']:
        buy_signals += stoch_weight
    elif last_row['STOCH_K'] > STOCH_OVERBOUGHT and last_row['STOCH_K'] < last_row['STOCH_D']:
        sell_signals += stoch_weight
    total_weight += stoch_weight

    # 12개월 모멘텀 기반 신호 (가중치: 2.0 - 가장 높음)
    momentum_weight = 2.0
    momentum_signal = last_row.get('Momentum_Signal', 'insufficient_data')
    momentum_score = last_row.get('Momentum_Score', 0)
    recent_trend = last_row.get('Recent_Trend', 'unknown')

    # 모멘텀 신호에 따른 점수 부여 (새로운 신호 포함)
    if momentum_signal == 'very_strong_up':
        buy_signals += momentum_weight * 1.0
    elif momentum_signal == 'strong_up':
        buy_signals += momentum_weight * 0.8
    elif momentum_signal == 'weak_up':
        buy_signals += momentum_weight * 0.4
    elif momentum_signal == 'neutral':
        # 중립 신호는 아무 점수도 추가하지 않음
        pass
    elif momentum_signal == 'neutral_up':
        buy_signals += momentum_weight * 0.2  # 약한 매수 신호
    elif momentum_signal == 'neutral_down':
        sell_signals += momentum_weight * 0.2  # 약한 매도 신호
    elif momentum_signal == 'weak_down':
        sell_signals += momentum_weight * 0.4
    elif momentum_signal == 'strong_down':
        sell_signals += momentum_weight * 0.8
    elif momentum_signal in ['insufficient_data', 'no_data']:
        # 데이터 부족시 중립 처리 (가중치를 전체에서 제외)
        total_weight -= momentum_weight  # 모멘텀 가중치를 전체에서 제외

    # 최근 트렌드 가속도 보정
    trend_adjustment = 0.3
    if recent_trend == 'accelerating':
        buy_signals += trend_adjustment
    elif recent_trend == 'decelerating':
        sell_signals += trend_adjustment

    total_weight += momentum_weight

    # 확률 계산 (가중치 반영)
    if total_weight > 0:
        buy_prob = min(100, (buy_signals / total_weight) * 100)
        sell_prob = min(100, (sell_signals / total_weight) * 100)

        # 관망 확률은 매수/매도 신호가 약할 때 증가
        signal_strength = buy_prob + sell_prob
        if signal_strength < 30:
            hold_prob = 100 - signal_strength
            buy_prob = buy_prob * 0.7
            sell_prob = sell_prob * 0.7
        else:
            hold_prob = max(0, 100 - buy_prob - sell_prob)
    else:
        buy_prob = sell_prob = hold_prob = 33.33

    return buy_prob, sell_prob, hold_prob

def get_etf_data() -> Dict:
    """ETF 데이터 정의 반환"""
    return {
        'etf_list': {
            # 주요 지수 ETF
            'SPY': 'S&P 500 ETF',
            'QQQ': '나스닥 100 ETF',
            'MCHI': '중국 MSCI ETF',
            'EWJ': '일본 MSCI ETF',
            'VGK': '유럽 FTSE ETF',
            'EWZ': '브라질 MSCI ETF',
            'EIDO': '인도네시아 MSCI ETF',
            'INDA': '인도 MSCI ETF',
            'VNM': '베트남 ETF',
            'EWA': '호주 MSCI ETF',

            # 섹터 ETF
            'XLK': '기술 섹터',
            'XLF': '금융 섹터',
            'XLC': '커뮤니케이션',
            'XLV': '헬스케어',
            'XLE': '에너지',
            'XLI': '산업재',
            'XLP': '필수소비재',
            'XLY': '임의소비재',

            # 첨단기술 ETF
            'ARKK': '혁신기술',
            'ARKG': '유전체혁신',
            'BOTZ': '로봇/AI',
            'ICLN': '친환경에너지',
            'SMH': '반도체',
            'IBB': '바이오텍',
            'SKYY': '클라우드',
            'ROBO': '로보틱스',
            'FINX': '핀테크',
            'HACK': '사이버보안'
        },
        'etf_categories': {
            '주요 지수': ['SPY', 'QQQ', 'MCHI', 'EWJ', 'VGK', 'EWZ', 'EIDO', 'INDA', 'VNM', 'EWA'],
            '섹터': ['XLK', 'XLF', 'XLC', 'XLV', 'XLE', 'XLI', 'XLP', 'XLY'],
            '첨단기술': ['ARKK', 'ARKG', 'BOTZ', 'ICLN', 'SMH', 'IBB', 'SKYY', 'ROBO', 'FINX', 'HACK']
        }
    }

def analyze_etfs():
    """ETF 분석 실행"""
    etf_data = get_etf_data()
    etf_list = etf_data['etf_list']
    etf_categories = etf_data['etf_categories']

    # 기간 설정
    periods = {
        '1개월': 30,
        '6개월': 180,
        '1년': 365,
        '3년': 1095,
        '5년': 1825,
        '10년': 3650
    }
    selected_period = st.selectbox('📅 분석 기간:', list(periods.keys()), index=2, key='etf_period')  # 기본값: 1년
    days = periods[selected_period]

    # 데이터 수집 기간 설정
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)

    with st.spinner("ETF 데이터를 분석 중입니다..."):
        # ETF 데이터 수집 및 수익률 계산
        returns_data = {}
        for symbol in etf_list.keys():
            try:
                df = fdr.DataReader(symbol, start_date, end_date)
                if not df.empty:
                    returns_data[symbol] = {
                        'name': etf_list[symbol],
                        'return': ((df['Close'].iloc[-1] / df['Close'].iloc[0]) - 1) * 100,
                        'category': next(cat for cat, symbols in etf_categories.items() if symbol in symbols)
                    }
            except Exception:
                st.warning(f"{etf_list[symbol]}({symbol}) 데이터 로드 실패")

        if returns_data:
            # 카테고리별 성과 시각화
            st.subheader("📈 ETF 카테고리별 수익률 분석")
            
            # 카테고리별 색상 설정
            category_colors = {
                '주요 지수': COLOR_PALETTE['primary'],
                '섹터': COLOR_PALETTE['success'],
                '첨단기술': COLOR_PALETTE['warning']
            }
            
            # 수익률 기준 정렬
            sorted_returns = sorted(returns_data.items(), key=lambda x: x[1]['return'], reverse=True)
            
            # 카테고리별 탭 생성
            cat_tabs = st.tabs(list(etf_categories.keys()))
            
            for idx, (category, tab) in enumerate(zip(etf_categories.keys(), cat_tabs)):
                with tab:
                    # 해당 카테고리의 ETF만 필터링
                    category_returns = [(symbol, data) for symbol, data in sorted_returns 
                                     if data['category'] == category]
                    
                    if category_returns:
                        fig = go.Figure()
                        fig.add_trace(go.Bar(
                            x=[f"{data['name']}\n({symbol})" for symbol, data in category_returns],
                            y=[data['return'] for symbol, data in category_returns],
                            text=[f"{data['return']:.1f}%" for symbol, data in category_returns],
                            textposition='auto',
                            marker_color=category_colors[category]
                        ))

                        fig.update_layout(
                            title=f"{category} ETF 최근 {selected_period} 수익률",
                            xaxis_title="ETF",
                            yaxis_title="수익률 (%)",
                            height=400,
                            showlegend=False
                        )
                        st.plotly_chart(fig, use_container_width=True)

                        # ETF별 상세 분석
                        st.subheader(f"🎯 {category} ETF 상세 분석")
                        cols = st.columns(2)
                        for i, (symbol, data) in enumerate(category_returns):
                            with cols[i % 2]:
                                with st.expander(f"{data['name']} ({symbol})"):
                                    # 수익률 게이지 차트
                                    fig_gauge = go.Figure(go.Indicator(
                                        mode="gauge+number",
                                        value=data['return'],
                                        title={'text': f"{symbol} 수익률"},
                                        gauge={
                                            'axis': {'range': [-10, 10]},
                                            'bar': {'color': category_colors[category]},
                                            'steps': [
                                                {'range': [-10, 0], 'color': "lightgray"},
                                                {'range': [0, 10], 'color': "lightgreen"}
                                            ],
                                            'threshold': {
                                                'line': {'color': "black", 'width': 2},
                                                'thickness': 0.75,
                                                'value': data['return']
                                            }
                                        }
                                    ))
                                    fig_gauge.update_layout(height=150)
                                    st.plotly_chart(fig_gauge, use_container_width=True)
                                    
                                    # ETF 상태 표시
                                    if data['return'] > 3:
                                        st.success("📈 강세")
                                    elif data['return'] > 0:
                                        st.info("↗️ 약세 상승")
                                    elif data['return'] > -3:
                                        st.warning("↘️ 약세 하락")
                                    else:
                                        st.error("📉 약세")
                    else:
                        st.warning(f"{category} 카테고리의 ETF 데이터가 없습니다.")

            # 투자 전략 제안
            st.markdown("---")
            st.subheader("💡 투자 전략 제안")
            
            # 카테고리별 평균 수익률 계산
            category_returns = {}
            for category in etf_categories.keys():
                category_data = [data['return'] for _, data in returns_data.items() 
                               if data['category'] == category]
                if category_data:
                    category_returns[category] = sum(category_data) / len(category_data)
            
            # 수익률 기준 카테고리 정렬
            sorted_categories = sorted(category_returns.items(), key=lambda x: x[1], reverse=True)
            
            # 파이 차트로 카테고리별 비중 표시
            if any(ret > 0 for _, ret in sorted_categories):
                positive_categories = [(cat, ret) for cat, ret in sorted_categories if ret > 0]
                total_return = sum(ret for _, ret in positive_categories)
                
                weights = {cat: min((ret/total_return) * 100, 40) 
                          for cat, ret in positive_categories}
                
                # 비중 정규화
                total_weight = sum(weights.values())
                weights = {k: (v/total_weight)*100 for k, v in weights.items()}
                
                fig_pie = go.Figure(data=[go.Pie(
                    labels=[f"{cat}\n({ret:.1f}%)" for cat, ret in positive_categories],
                    values=list(weights.values()),
                    textinfo='label+percent',
                    marker_colors=[category_colors[cat] for cat, _ in positive_categories]
                )])
                
                fig_pie.update_layout(
                    title="추천 카테고리별 투자 비중",
                    height=400,
                    showlegend=False
                )
                st.plotly_chart(fig_pie, use_container_width=True)
                
                # 투자 전략 설명
                st.markdown("### 📌 투자 전략")
                for category, return_val in sorted_categories:
                    if return_val > 0:
                        weight = weights.get(category, 0)
                        st.markdown(f"- **{category}**: {weight:.1f}% 비중 배분 (수익률: {return_val:.1f}%)")
            else:
                st.warning("⚠️ 현재 시장 상황이 좋지 않아 현금 비중을 높게 유지하는 것을 추천합니다.")

def get_asset_data() -> Dict:
    """글로벌 자산 데이터 정의 반환"""
    return {
        # 주식
        'SPY': 'S&P 500',
        'QQQ': 'NASDAQ',
        'EWY': 'KOSPI',
        'KORU': 'KOSDAQ',
        # 채권
        'SHY': '미국 단기채',
        'IEF': '미국 중기채',
        'TLT': '미국 장기채',
        # 실물자산
        'GLD': '금',
        'DBC': '원자재',
        'BITO': '비트코인'
    }

def analyze_asset_allocation():
    """자산 배분 분석 실행"""
    asset_list = get_asset_data()

    # 기간 설정
    periods = {
        '1개월': 30,
        '6개월': 180,
        '1년': 365,
        '3년': 1095,
        '5년': 1825,
        '10년': 3650
    }
    selected_period = st.selectbox('📅 분석 기간:', list(periods.keys()), index=2, key='asset_period')  # 기본값: 1년
    days = periods[selected_period]

    # 데이터 수집 기간 설정
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)

    with st.spinner("글로벌 자산 데이터를 분석 중입니다..."):
        # 자산별 데이터 수집 및 수익률 계산
        returns_data = {}
        for symbol, name in asset_list.items():
            try:
                df = fdr.DataReader(symbol, start_date, end_date)
                if not df.empty:
                    returns_data[symbol] = {
                        'name': name,
                        'return': ((df['Close'].iloc[-1] / df['Close'].iloc[0]) - 1) * 100,
                        'volatility': df['Close'].pct_change().std() * np.sqrt(252) * 100
                    }
            except Exception:
                st.warning(f"{name}({symbol}) 데이터 로드 실패")

        if returns_data:
            # 자산군별 성과 시각화
            st.subheader("📊 글로벌 자산군 성과 분석")
            
            # 수익률 차트
            fig_returns = go.Figure()
            
            # 자산군 별로 색상 지정
            colors = {
                'SPY': COLOR_PALETTE['primary'], 'QQQ': COLOR_PALETTE['success'],
                'EWY': COLOR_PALETTE['danger'], 'KORU': COLOR_PALETTE['purple'],  # 주식
                'SHY': COLOR_PALETTE['warning'], 'IEF': COLOR_PALETTE['warning'],
                'TLT': COLOR_PALETTE['warning'],  # 채권
                'GLD': COLOR_PALETTE['gold'], 'DBC': COLOR_PALETTE['brown'],
                'BITO': COLOR_PALETTE['pink']  # 실물자산
            }
            
            # 수익률 기준 정렬
            sorted_returns = sorted(returns_data.items(), key=lambda x: x[1]['return'], reverse=True)
            
            fig_returns.add_trace(go.Bar(
                x=[f"{data['name']}\n({symbol})" for symbol, data in sorted_returns],
                y=[data['return'] for symbol, data in sorted_returns],
                text=[f"{data['return']:.1f}%" for symbol, data in sorted_returns],
                textposition='auto',
                marker_color=[colors[symbol] for symbol, _ in sorted_returns]
            ))

            fig_returns.update_layout(
                title="최근 {selected_period} 수익률",
                xaxis_title="자산",
                yaxis_title="수익률 (%)",
                height=400,
                showlegend=False
            )
            st.plotly_chart(fig_returns, use_container_width=True)

            # 자산군별 상세 분석
            st.subheader("🎯 자산군별 상세 분석")
            
            col1, col2 = st.columns(2)
            for idx, (symbol, data) in enumerate(sorted_returns):
                with col1 if idx % 2 == 0 else col2:
                    with st.expander(f"{data['name']} ({symbol})"):
                        # 수익률과 변동성 게이지
                        col_ret, col_vol = st.columns(2)
                        
                        with col_ret:
                            fig_gauge = go.Figure(go.Indicator(
                                mode="gauge+number",
                                value=data['return'],
                                title={'text': "수익률 (%)"},
                                gauge={
                                    'axis': {'range': [-10, 10]},
                                    'bar': {'color': colors[symbol]},
                                    'steps': [
                                        {'range': [-10, 0], 'color': "lightgray"},
                                        {'range': [0, 10], 'color': "lightgreen"}
                                    ],
                                    'threshold': {
                                        'line': {'color': "black", 'width': 2},
                                        'thickness': 0.75,
                                        'value': data['return']
                                    }
                                }
                            ))
                            fig_gauge.update_layout(height=150)
                            st.plotly_chart(fig_gauge, use_container_width=True)
                            
                        with col_vol:
                            fig_vol = go.Figure(go.Indicator(
                                mode="gauge+number",
                                value=data['volatility'],
                                title={'text': "변동성 (%)"},
                                gauge={
                                    'axis': {'range': [0, 50]},
                                    'bar': {'color': colors[symbol]},
                                    'steps': [
                                        {'range': [0, 20], 'color': "lightgreen"},
                                        {'range': [20, 35], 'color': "lightyellow"},
                                        {'range': [35, 50], 'color': "lightpink"}
                                    ],
                                    'threshold': {
                                        'line': {'color': "black", 'width': 2},
                                        'thickness': 0.75,
                                        'value': data['volatility']
                                    }
                                }
                            ))
                            fig_vol.update_layout(height=150)
                            st.plotly_chart(fig_vol, use_container_width=True)
                        
                        # 자산 상태 평가
                        if data['return'] > 3:
                            st.success("📈 강세 자산")
                        elif data['return'] > 0:
                            st.info("↗️ 약세 상승")
                        elif data['return'] > -3:
                            st.warning("↘️ 약세 하락")
                        else:
                            st.error("📉 약세 자산")
                            
                        # 변동성 평가
                        vol_status = "낮음" if data['volatility'] < 20 else "중간" if data['volatility'] < 35 else "높음"
                        st.markdown(f"**변동성**: {vol_status} ({data['volatility']:.1f}%)")

def create_candlestick_chart(df: pd.DataFrame) -> go.Figure:
    fig = go.Figure()
    
    # 캔들스틱 차트
    fig.add_trace(go.Candlestick(
        x=df.index,
        open=df['Open'],
        high=df['High'],
        low=df['Low'],
        close=df['Close'],
        name='캔들스틱'
    ))
    
    # 볼린저 밴드
    fig.add_trace(go.Scatter(
        x=df.index, 
        y=df['BB_High'], 
        name='볼린저 상단', 
        line=dict(color='gray', dash='dash')
    ))
    fig.add_trace(go.Scatter(
        x=df.index, 
        y=df['BB_Mid'], 
        name='볼린저 중간', 
        line=dict(color='gray')
    ))
    fig.add_trace(go.Scatter(
        x=df.index, 
        y=df['BB_Low'], 
        name='볼린저 하단', 
        line=dict(color='gray', dash='dash')
    ))
    
    fig.update_layout(
        yaxis_title="가격",
        xaxis_title="날짜",
        height=400
    )
    
    return fig

def create_rsi_mfi_chart(df: pd.DataFrame) -> go.Figure:
    fig = go.Figure()
    
    fig.add_trace(go.Scatter(
        x=df.index, 
        y=df['RSI'], 
        name='RSI',
        line=dict(color=COLOR_PALETTE['primary'])
    ))
    fig.add_trace(go.Scatter(
        x=df.index, 
        y=df['MFI'], 
        name='MFI',
        line=dict(color=COLOR_PALETTE['warning'])
    ))
    
    fig.add_hline(y=70, line_dash="dash", line_color="red", annotation_text="과매수")
    fig.add_hline(y=30, line_dash="dash", line_color="green", annotation_text="과매도")
    
    fig.update_layout(
        title="RSI & MFI 지표",
        height=300,
        showlegend=True,
        legend=dict(
            orientation="h",
            yanchor="bottom",
            y=1.02,
            xanchor="right",
            x=1
        )
    )
    
    return fig

def create_macd_chart(df: pd.DataFrame) -> go.Figure:
    fig = go.Figure()
    
    # MACD 라인
    fig.add_trace(go.Scatter(
        x=df.index, 
        y=df['MACD'], 
        name='MACD',
        line=dict(color=COLOR_PALETTE['primary'])
    ))
    
    # 시그널 라인
    fig.add_trace(go.Scatter(
        x=df.index, 
        y=df['MACD_Signal'], 
        name='Signal',
        line=dict(color=COLOR_PALETTE['warning'])
    ))
    
    # MACD 히스토그램
    colors = ['red' if val < 0 else 'green' for val in (df['MACD'] - df['MACD_Signal'])]
    fig.add_trace(go.Bar(
        x=df.index,
        y=df['MACD'] - df['MACD_Signal'],
        name='MACD Histogram',
        marker_color=colors,
        opacity=0.5
    ))
    
    fig.update_layout(
        title="MACD 지표",
        height=300,
        showlegend=True,
        legend=dict(
            orientation="h",
            yanchor="bottom",
            y=1.02,
            xanchor="right",
            x=1
        )
    )
    
    return fig

def create_stochastic_chart(df: pd.DataFrame) -> go.Figure:
    fig = go.Figure()
    
    fig.add_trace(go.Scatter(
        x=df.index, 
        y=df['STOCH_K'], 
        name='%K',
        line=dict(color=COLOR_PALETTE['primary'])
    ))
    fig.add_trace(go.Scatter(
        x=df.index, 
        y=df['STOCH_D'], 
        name='%D',
        line=dict(color=COLOR_PALETTE['warning'])
    ))
    
    fig.add_hline(y=80, line_dash="dash", line_color="red", annotation_text="과매수")
    fig.add_hline(y=20, line_dash="dash", line_color="green", annotation_text="과매도")
    
    fig.update_layout(
        title="Stochastic 지표",
        height=300,
        showlegend=True,
        legend=dict(
            orientation="h",
            yanchor="bottom",
            y=1.02,
            xanchor="right",
            x=1
        )
    )
    
    return fig

def create_obv_chart(df: pd.DataFrame) -> go.Figure:
    fig = go.Figure()
    
    fig.add_trace(go.Scatter(
        x=df.index, 
        y=df['OBV'], 
        name='OBV',
        line=dict(color=COLOR_PALETTE['primary'])
    ))
    
    # OBV 이동평균선 추가
    obv_ma = df['OBV'].rolling(window=20).mean()
    fig.add_trace(go.Scatter(
        x=df.index,
        y=obv_ma,
        name='OBV MA(20)',
        line=dict(color='#ff7f0e', dash='dash')
    ))
    
    fig.update_layout(
        title="OBV (On Balance Volume)",
        height=300,
        showlegend=True,
        legend=dict(
            orientation="h",
            yanchor="bottom",
            y=1.02,
            xanchor="right",
            x=1
        )
    )
    
    return fig

def create_momentum_chart(df: pd.DataFrame) -> go.Figure:
    """12개월 모멘텀 분석 차트 생성"""
    fig = go.Figure()

    try:
        # 인덱스가 datetime이 아닌 경우 변환
        if not isinstance(df.index, pd.DatetimeIndex):
            df.index = pd.to_datetime(df.index)

        # 월별 데이터 추출 (인덱스 기반) - ME 사용으로 FutureWarning 해결
        df_monthly = df.resample('ME').last()

        if len(df_monthly) < 1:
            # 데이터 부족시 빈 차트 반환
            fig.add_annotation(
                text="데이터가 부족합니다 (최소 1개월 필요)",
                xref="paper", yref="paper",
                x=0.5, y=0.5, showarrow=False
            )
            fig.update_layout(title="12개월 모멘텀 분석", height=300)
            return fig

        # 월별 수익률 계산
        df_monthly['Monthly_Return'] = df_monthly['Close'].pct_change() * 100
        recent_12m = df_monthly.tail(12).dropna()

        # 데이터가 1개월만 있어도 표시 가능하도록 수정
        if len(recent_12m) < 1:
            fig.add_annotation(
                text="유효한 데이터가 없습니다",
                xref="paper", yref="paper",
                x=0.5, y=0.5, showarrow=False
            )
            fig.update_layout(title="12개월 모멘텀 분석", height=300)
            return fig

        if len(recent_12m) == 0:
            fig.add_annotation(
                text="모멘텀 데이터를 계산할 수 없습니다",
                xref="paper", yref="paper",
                x=0.5, y=0.5, showarrow=False
            )
            fig.update_layout(title="12개월 모멘텀 분석", height=300)
            return fig

        # 색상 설정 (양수=녹색, 음수=빨간색)
        colors = ['green' if ret > 0 else 'red' for ret in recent_12m['Monthly_Return']]

        # 월별 수익률 막대 차트
        fig.add_trace(go.Bar(
            x=[date.strftime('%Y-%m') for date in recent_12m.index],
            y=recent_12m['Monthly_Return'],
            marker_color=colors,
            name='월별 수익률',
            text=[f'{ret:.1f}%' for ret in recent_12m['Monthly_Return']],
            textposition='outside'
        ))

        # 0% 기준선
        fig.add_hline(y=0, line_dash="dash", line_color="gray", annotation_text="기준선 (0%)")

        # 양수 월 개수 표시
        positive_count = (recent_12m['Monthly_Return'] > 0).sum()
        total_count = len(recent_12m['Monthly_Return'])

        fig.update_layout(
            title=f"12개월 모멘텀 분석 (양수: {positive_count}/{total_count}개월)",
            xaxis_title="월",
            yaxis_title="수익률 (%)",
            height=300,
            showlegend=False
        )

        return fig

    except Exception as e:
        # 오류 발생시 에러 메시지 표시
        fig.add_annotation(
            text=f"차트 생성 오류: {str(e)}",
            xref="paper", yref="paper",
            x=0.5, y=0.5, showarrow=False
        )
        fig.update_layout(title="12개월 모멘텀 분석 (오류)", height=300)
        return fig

def create_momentum_gauge(df: pd.DataFrame) -> go.Figure:
    """모멘텀 스코어 게이지 차트 생성"""
    momentum_score = df.iloc[-1].get('Momentum_Score', 0)
    momentum_signal = df.iloc[-1].get('Momentum_Signal', 'insufficient_data')
    positive_months = df.iloc[-1].get('Positive_Months', 0)
    total_months = df.iloc[-1].get('Total_Months', 0)

    # 신호별 색상 설정
    signal_colors = {
        'very_strong_up': '#006400',
        'strong_up': '#32CD32',
        'weak_up': '#9ACD32',
        'neutral': '#C0C0C0',
        'neutral_up': '#B0D4B8',
        'neutral_down': '#D4B0B8',
        'weak_down': '#FFD700',
        'strong_down': '#FF6347',
        'insufficient_data': '#808080',
        'no_data': '#696969',
        'error': '#808080'
    }

    signal_texts = {
        'very_strong_up': '매우 강한 상승',
        'strong_up': '강한 상승',
        'weak_up': '약한 상승',
        'neutral': '중립',
        'neutral_up': '약간 상승',
        'neutral_down': '약간 하락',
        'weak_down': '약한 하락',
        'strong_down': '강한 하락',
        'insufficient_data': '데이터 부족',
        'no_data': '데이터 없음',
        'error': '계산 오류'
    }

    fig = go.Figure(go.Indicator(
        mode="gauge+number+delta",
        value=momentum_score,
        domain={'x': [0, 1], 'y': [0, 1]},
        title={'text': f"모멘텀 스코어<br><span style='font-size:0.8em;color:gray'>{signal_texts.get(momentum_signal, '알 수 없음')}</span>"},
        delta={'reference': 50},
        gauge={
            'axis': {'range': [None, 100]},
            'bar': {'color': signal_colors.get(momentum_signal, '#808080')},
            'steps': [
                {'range': [0, 25], 'color': "lightgray"},
                {'range': [25, 45], 'color': "yellow"},
                {'range': [45, 60], 'color': "lightgreen"},
                {'range': [60, 75], 'color': "green"},
                {'range': [75, 100], 'color': "darkgreen"}
            ],
            'threshold': {
                'line': {'color': "red", 'width': 4},
                'thickness': 0.75,
                'value': 90
            }
        }
    ))

    fig.update_layout(
        height=250,
        margin={'l': 20, 'r': 20, 't': 40, 'b': 20}
    )

    return fig

def analyze_individual_stock(stock_code: str, days: int, selected_period: str):
    """개별 주식 분석"""
    try:
        # 주식 데이터 로드
        df = load_stock_data(stock_code, days)
        if df is not None and not df.empty:
            # 기술적 지표 계산
            df = calculate_technical_indicators(df)

            # 캔들스틱 차트
            st.subheader(f"{stock_code} 주가 차트 ({selected_period} 기준)")
            fig = create_candlestick_chart(df)
            st.plotly_chart(fig, use_container_width=True)

            # 차트 그리기
            col1, col2 = st.columns(2)

            with col1:
                # RSI & MFI 차트
                fig_rsi_mfi = create_rsi_mfi_chart(df)
                st.plotly_chart(fig_rsi_mfi, use_container_width=True)

                # Stochastic 차트
                fig_stoch = create_stochastic_chart(df)
                st.plotly_chart(fig_stoch, use_container_width=True)

            with col2:
                # MACD 차트
                fig_macd = create_macd_chart(df)
                st.plotly_chart(fig_macd, use_container_width=True)

                # OBV 차트
                fig_obv = create_obv_chart(df)
                st.plotly_chart(fig_obv, use_container_width=True)

            # 12개월 모멘텀 분석
            st.subheader("📈 12개월 모멘텀 분석")
            col1, col2 = st.columns([2, 1])

            with col1:
                # 월별 수익률 차트
                fig_momentum = create_momentum_chart(df)
                st.plotly_chart(fig_momentum, use_container_width=True)

            with col2:
                # 모멘텀 스코어 게이지
                fig_gauge = create_momentum_gauge(df)
                st.plotly_chart(fig_gauge, use_container_width=True)

                # 모멘텀 상세 정보
                momentum_score = df.iloc[-1].get('Momentum_Score', 0)
                positive_months = df.iloc[-1].get('Positive_Months', 0)
                total_months = df.iloc[-1].get('Total_Months', 0)
                momentum_strength = df.iloc[-1].get('Momentum_Strength', 0)
                recent_trend = df.iloc[-1].get('Recent_Trend', 'unknown')

                st.metric("모멘텀 스코어", f"{momentum_score:.1f}")
                st.metric("양수 월", f"{positive_months}/{total_months}")
                st.metric("평균 상승률", f"{momentum_strength:.1f}%")

                # 최근 트렌드 표시
                trend_emoji = {
                    'accelerating': '🚀',
                    'stable_up': '📈',
                    'stable_down': '📉',
                    'decelerating': '⬇️',
                    'unknown': '❓'
                }
                trend_text = {
                    'accelerating': '가속 상승',
                    'stable_up': '안정 상승',
                    'stable_down': '안정 하락',
                    'decelerating': '가속 하락',
                    'unknown': '알 수 없음'
                }

                st.markdown(f"**최근 트렌드**: {trend_emoji.get(recent_trend, '❓')} {trend_text.get(recent_trend, '알 수 없음')}")

            # 투자 결정 확률
            buy_prob, sell_prob, hold_prob = make_investment_decision(df)

            st.subheader("💡 투자 결정 확률 (모멘텀 포함)")
            col1, col2, col3 = st.columns(3)
            col1.metric("📈 매수 확률", f"{buy_prob:.1f}%")
            col2.metric("📉 매도 확률", f"{sell_prob:.1f}%")
            col3.metric("⏳ 관망 확률", f"{hold_prob:.1f}%")

            # 모멘텀 기여도 표시
            momentum_signal = df.iloc[-1].get('Momentum_Signal', 'insufficient_data')
            momentum_contribution = {
                'very_strong_up': '모멘텀이 강력한 매수 신호를 제공합니다',
                'strong_up': '모멘텀이 매수 신호를 지지합니다',
                'weak_up': '모멘텀이 약한 매수 신호를 보입니다',
                'neutral': '모멘텀이 중립적인 신호를 보입니다',
                'neutral_up': '모멘텀이 약간 긍정적인 신호를 보입니다',
                'neutral_down': '모멘텀이 약간 부정적인 신호를 보입니다',
                'weak_down': '모멘텀이 약한 매도 신호를 보입니다',
                'strong_down': '모멘텀이 매도 신호를 지지합니다',
                'insufficient_data': '모멘텀 분석을 위한 데이터가 부족합니다',
                'no_data': '모멘텀 분석을 위한 데이터가 없습니다'
            }

            st.info(f"🔍 **모멘텀 기여도**: {momentum_contribution.get(momentum_signal, '모멘텀 분석 불가')}")

            # 투자 결정 해석
            st.subheader("🎯 투자 결정 해석")
            max_prob = max(buy_prob, sell_prob, hold_prob)
            if max_prob == buy_prob:
                st.success("✨ 현재 매수 신호가 강합니다.")
            elif max_prob == sell_prob:
                st.error("⚠️ 현재 매도 신호가 강합니다.")
            else:
                st.warning("🤔 현재 관망이 권장됩니다.")
        else:
            st.error("📉 주식 데이터를 불러올 수 없습니다.")

    except Exception as e:
        st.error(f"❌ 오류가 발생했습니다: {str(e)}")

def main():
    """메인 애플리케이션"""
    st.title("📈 주식 분석 및 투자 결정 도우미")

    # 사이드바 설정
    stock_code, days = setup_sidebar()
    add_sidebar_info()

    # 선택된 기간 정보 가져오기
    period_options = {
        '1년': 365,
        '2년': 730,
        '3년': 1095,
        '5년': 1825,
        '10년': 3650
    }
    selected_period = next(key for key, value in period_options.items() if value == days)

    # 탭 생성
    tab1, tab2, tab3 = st.tabs(["📊 개별 주식 분석", "🌎 섹터 ETF 분석", "💰 자산배분 분석"])

    with tab1:
        analyze_individual_stock(stock_code, days, selected_period)

    with tab2:
        analyze_etfs()

    with tab3:
        analyze_asset_allocation()

# Streamlit 앱 실행
main()

if __name__ == "__main__":
    import subprocess
    import sys
    import os

    # 환경변수로 포트 고정 설정
    os.environ['STREAMLIT_SERVER_PORT'] = str(PORT)
    os.environ['STREAMLIT_SERVER_HEADLESS'] = 'true'

    # 현재 스크립트가 직접 실행되는 경우 포트 8999로 streamlit 실행
    if len(sys.argv) == 1:  # streamlit run이 아닌 python으로 직접 실행하는 경우
        script_path = os.path.abspath(__file__)
        subprocess.run([
            sys.executable, "-m", "streamlit", "run",
            script_path, "--server.port", str(PORT), "--server.headless", "true"
        ]) 
