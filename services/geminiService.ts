import { GoogleGenAI } from "@google/genai";
import { AnalysisResult, ChannelAnalysisView, VideoData, ShortsData, ChannelInfo } from '../types';
import { GEMINI_CONFIG, API_ERROR_MESSAGES } from '../constants';
import { extractErrorMessage } from '../utils';

const getTopVideosPrompt = (analysisResult: AnalysisResult, query: string) => `
당신은 대한민국 최고의 유튜브 채널 성장 전략 컨설턴트입니다.
다음은 채널 '${analysisResult.channelInfo?.title}'의 '인기도 상위 10개 영상' 데이터 분석 결과입니다.

[데이터 분석 결과]
${JSON.stringify(analysisResult.videos.map(v => ({
  '제목': v.title, '조회수': v.viewCount, '좋아요': v.likeCount, '댓글수': v.commentCount, '영상길이(초)': v.duration, '인기도 점수': v.popularityScore,
})), null, 2)}

[요청]
이 데이터를 기반으로, 채널의 성공 요인을 극대화하고 지속적인 성장을 이끌어낼 구체적이고 실행 가능한 새로운 전략을 한국어로 제안해주세요.
결과는 마크다운 형식으로, 다음 항목을 반드시 포함하여 체계적으로 작성해주세요.

### 1. 성공 요인 분석 (What's working?)
- 현재 가장 반응이 좋은 콘텐츠(인기도 TOP 10)의 공통적인 특징 (주제, 형식, 길이, 썸네일/제목 스타일 등)은 무엇인가요?
- 인기도 점수가 높은 영상들의 핵심 성공 동력(Key Driver)을 분석해주세요.
- 시청자들이 어떤 종류의 콘텐츠에 가장 열광적으로 참여(좋아요, 댓글)하는지 분석해주세요.

### 2. 타겟 시청자 프로필 및 확대 전략
- 성공적인 영상을 소비하는 핵심 타겟 시청자층을 정의하고, 그들의 니즈를 분석해주세요.
- 현재 시청자층의 충성도를 높이고, 유사한 성향의 잠재 시청자층을 추가로 유입시킬 방안을 제안해주세요.

### 3. '성공 공식' 기반 콘텐츠 전략 제안
- **성과가 좋은 콘텐츠 강화:** 현재의 성공 공식을 어떻게 발전시키고 확장할 수 있을까요? (시리즈화, 심화 콘텐츠 등)
- **새로운 콘텐츠 아이디어:** 분석된 성공 요인을 바탕으로 시너지를 낼 수 있는 새로운 영상 아이디어 3가지를 구체적으로 제안해주세요. (제목 예시 포함)
- **영상 길이 최적화:** 성공적인 영상들의 길이를 참고하여, 채널에 가장 적합한 영상 길이 전략을 제안해주세요.

### 4. 채널 성장 가속화 로드맵
- 성공적인 영상의 썸네일과 제목 스타일을 분석하고, 이를 표준화할 수 있는 템플릿 아이디어를 제안해주세요.
- 팬덤을 구축하고 시청자 참여를 극대화하기 위한 커뮤니티 운영 전략은 무엇이 있을까요?
- 앞으로 3개월간의 콘텐츠 제작 및 채널 성장 단기 로드맵을 제시해주세요.
`;

const getBottomVideosPrompt = (analysisResult: AnalysisResult, query: string) => `
당신은 대한민국 최고의 유튜브 채널 문제 해결 및 성장 전략 컨설턴트입니다.
다음은 채널 '${analysisResult.channelInfo?.title}'의 '인기도 하위 10개 영상' 데이터 분석 결과입니다.

[데이터 분석 결과]
${JSON.stringify(analysisResult.videos.map(v => ({
  '제목': v.title, '조회수': v.viewCount, '좋아요': v.likeCount, '댓글수': v.commentCount, '영상길이(초)': v.duration, '인기도 점수': v.popularityScore,
})), null, 2)}

[요청]
이 데이터를 기반으로, 채널의 부진한 성과를 개선하고 채널의 잠재력을 최대한 끌어올릴 수 있는 구체적이고 실행 가능한 '개선 전략'을 한국어로 제안해주세요.
결과는 마크다운 형식으로, 다음 항목을 반드시 포함하여 체계적으로 작성해주세요.

### 1. 문제점 진단 (What's not working?)
- 현재 반응이 좋지 않은 콘텐츠(인기도 하위 10)의 공통적인 문제점 (주제, 형식, 길이, 썸네일/제목 스타일 등)은 무엇인가요?
- 인기도 점수가 낮은 영상들의 핵심 부진 원인을 분석해주세요. (인기도 상위 영상과 비교 분석 포함)
- 시청자들의 참여(좋아요, 댓글)가 저조한 이유를 분석해주세요.

### 2. 개선 타겟 및 콘텐츠 방향 재설정
- 부진한 영상들이 타겟 시청자의 니즈를 충족시키지 못한 부분을 분석해주세요.
- 채널의 방향성을 유지하면서도 시청자의 흥미를 끌 수 있는 새로운 콘텐츠 방향을 제안해주세요.

### 3. '성과 개선'을 위한 콘텐츠 전략 제안
- **기존 콘텐츠 개선:** 성과가 저조했던 주제를 다른 형식이나 접근 방식으로 재도전할 아이디어가 있을까요?
- **새로운 '성공 확률이 높은' 콘텐츠 아이디어:** 채널의 강점과 성공적인 영상들의 특징을 결합하여, 실패 확률이 낮은 새로운 영상 아이디어 3가지를 구체적으로 제안해주세요. (제목 예시 포함)
- **실험적인 콘텐츠 제안:** 시청자 반응을 테스트하고 새로운 활로를 찾기 위한 저비용-고효율의 실험적인 콘텐츠 아이디어를 제안해주세요.

### 4. 채널 재정비 및 성장 로드맵
- 시청자의 클릭을 유도하지 못하는 썸네일과 제목의 문제점을 지적하고, 개선을 위한 A/B 테스트 아이디어를 제안해주세요.
- 이탈하는 시청자를 붙잡고 소통을 활성화하기 위한 커뮤니티 운영 전략은 무엇이 있을까요?
- 앞으로 3개월간 채널의 문제점을 개선하고 다시 성장궤도에 오르기 위한 단기 로드맵을 제시해주세요.
`;


const getKeywordPrompt = (analysisResult: AnalysisResult, query: string) => `
당신은 대한민국 최고의 유튜브 키워드 및 트렌드 분석가입니다.
다음은 키워드 '${query}'에 대한 '연관성 높은 상위 50개 영상' 데이터 분석 결과입니다.

[데이터 분석 결과]
${JSON.stringify(analysisResult.videos.map(v => ({
  '제목': v.title, '조회수': v.viewCount, '좋아요': v.likeCount, '댓글수': v.commentCount, '영상길이(초)': v.duration, '인기도 점수': v.popularityScore,
})), null, 2)}

[요청]
이 데이터를 기반으로, '${query}' 키워드를 활용하여 유튜브 채널을 성공적으로 운영하기 위한 구체적이고 실행 가능한 새로운 전략을 한국어로 제안해주세요.
결과는 마크다운 형식으로, 다음 항목을 반드시 포함하여 체계적으로 작성해주세요.

### 1. 키워드 기반 시장 분석
- 현재 '${query}' 키워드로 가장 반응이 좋은 콘텐츠의 특징 (주제, 형식, 길이 등)은 무엇인가요?
- 인기도 점수가 높은 영상과 낮은 영상의 차이점을 분석하여 성공 공식을 도출해주세요.
- 시청자들이 어떤 종류의 콘텐츠에 더 많이 참여(좋아요, 댓글)하는지 분석해주세요.

### 2. 타겟 시청자 프로필 및 확대 전략
- 분석된 데이터를 바탕으로 '${query}' 키워드의 핵심 타겟 시청자층을 정의해주세요.
- 잠재적인 시청자층을 확대하기 위한 콘텐츠 차별화 방안을 제안해주세요.

### 3. 콘텐츠 전략 제안
- **성과가 좋은 콘텐츠 벤치마킹 및 강화:** 현재 인기 있는 콘텐츠를 어떻게 우리 채널에 맞게 발전시킬 수 있을까요?
- **'${query}' 키워드를 활용한 새로운 콘텐츠 아이디어:** 분석 결과를 바탕으로 성공 확률이 높은 새로운 영상 아이디어 3가지를 구체적으로 제안해주세요. (제목 예시 포함)
- **영상 길이 최적화:** 쇼츠와 긴 영상의 비율 등 영상 길이에 대한 전략을 제안해주세요.

### 4. 채널 운영 및 성장 로드맵
- '${query}' 키워드에 최적화된 썸네일과 제목을 만들기 위한 A/B 테스트 아이디어를 제안해주세요.
- 시청자 참여를 높이기 위한 커뮤니티 운영 전략은 무엇이 있을까요?
- 앞으로 3개월간의 콘텐츠 제작 및 채널 성장 단기 로드맵을 제시해주세요.
`;

const getBlueOceanPrompt = (analysisResult: AnalysisResult, query: string) => {
  const videos = analysisResult.videos;
  const viewCounts = videos.map(v => v.viewCount);
  const avgViews = viewCounts.reduce((a, b) => a + b, 0) / viewCounts.length;
  const medianViews = [...viewCounts].sort((a, b) => a - b)[Math.floor(viewCounts.length / 2)];

  // 채널 집중도 계산
  const channelMap = new Map<string, number>();
  videos.forEach(v => {
    const channelKey = v.channelId || v.channelTitle || v.id;
    channelMap.set(channelKey, (channelMap.get(channelKey) || 0) + 1);
  });
  const uniqueChannels = channelMap.size;
  const channelConcentration = videos.length > 0 ? (uniqueChannels / videos.length) * 100 : 0;

  return `
당신은 대한민국 최고의 유튜브 시장 분석 및 블루오션 발굴 전문가입니다.
다음은 키워드/해시태그 '${query}'에 대한 상위 인기 영상 데이터 분석 결과입니다.

[데이터 분석 결과]
총 ${videos.length}개 영상 분석:
${JSON.stringify(videos.map(v => ({
    '제목': v.title, '조회수': v.viewCount, '좋아요': v.likeCount, '댓글수': v.commentCount, '영상길이(초)': v.duration, '인기도 점수': v.popularityScore,
  })), null, 2)}

[시장 지표]
- 평균 조회수: ${avgViews.toLocaleString()}
- 중간값 조회수: ${medianViews.toLocaleString()}
- 조회수 분포: 평균 대비 중간값 비율 ${((medianViews / avgViews) * 100).toFixed(1)}%
- 채널 집중도: ${channelConcentration.toFixed(1)}% (낮을수록 소수 독점, 높을수록 분산)

[요청]
이 데이터를 기반으로 '${query}' 키워드/해시태그 시장의 레드오션/블루오션 여부를 종합적으로 판단하고, 실행 가능한 전략을 한국어로 제안해주세요.
결과는 마크다운 형식으로, 다음 항목을 반드시 포함하여 체계적으로 작성해주세요.

### 1. 시장 지표 해석 및 레드/블루오션 판단
- 조회수 분포 분석: 평균과 중간값 비교를 통해 소수 독점인지 고르게 분산된 시장인지 판단해주세요.
- 채널 집중도 분석: 상위 인기 영상을 만든 채널 수를 분석해 과점 현상 여부를 확인하고 설명해주세요.
- 종합 판단: 위 지표들을 종합하여 레드오션(경쟁 치열)인지 블루오션(기회)인지 판단하고 이유를 설명해주세요.

### 2. 시장 진입 전략
- **블루오션 판단 시:** 진입하기 좋은 시장으로 판단되면 구체적인 진입 전략과 실행 방안을 제시해주세요.
- **레드오션 판단 시:** 경쟁이 치열한 시장으로 판단되면 니치 전략, 차별화 포인트, 대안 접근법을 제시해주세요.

### 3. 차별화 전략 제안
- 성공 가능성이 높은 콘텐츠 콘셉트 차별화 포인트를 구체적으로 제안해주세요.
- 업로드 주기, 영상 형식, 길이 등 운영 전략을 제안해주세요.
- 타겟 시청자층을 명확히 정의하고 그들에게 접근할 방법을 제시해주세요.

### 4. 실행 가능한 액션 플랜
- 진입/차별화를 위한 구체적인 3개월 실행 계획을 단계별로 제시해주세요.
- 각 단계별 목표와 성공 지표를 명시해주세요.
- 리스크 요소와 대응 방안을 포함해주세요.
`;
};

export const generateStrategy = async (
  analysisResult: AnalysisResult,
  query: string,
  type: string,
  channelView?: ChannelAnalysisView | null
): Promise<string> => {
  // Vite 환경변수 접근: vite.config.ts의 define으로 설정된 process.env.API_KEY 또는 import.meta.env 사용
  const apiKey = (process.env.API_KEY as string) || (import.meta.env.GEMINI_API_KEY as string) || (import.meta.env.VITE_GEMINI_API_KEY as string);

  if (!apiKey) {
    throw new Error(API_ERROR_MESSAGES.GEMINI_INVALID_KEY);
  }

  const ai = new GoogleGenAI({ apiKey });

  let prompt = '';
  if (type === 'CHANNEL') {
    if (channelView === ChannelAnalysisView.TOP) {
      prompt = getTopVideosPrompt(analysisResult, query);
    } else {
      prompt = getBottomVideosPrompt(analysisResult, query);
    }
  } else if (type === 'KEYWORD') {
    prompt = getKeywordPrompt(analysisResult, query);
  } else if (type === 'BLUE_OCEAN') {
    prompt = getBlueOceanPrompt(analysisResult, query);
  } else if (type === 'RISING_STAR') {
    // 라이징 스타는 채널 분석과 유사하지만 성장 관점에서 접근
    prompt = getTopVideosPrompt(analysisResult, query).replace(
      '인기도 상위 10개 영상',
      '최근 급성장 중인 채널의 영상'
    );
  } else {
    prompt = getKeywordPrompt(analysisResult, query);
  }

  try {
    console.log('Generating strategy with Gemini API...');
    console.log('API Key present:', !!apiKey, 'API Key length:', apiKey?.length || 0);

    const response = await ai.models.generateContent({
      model: GEMINI_CONFIG.DEFAULT_MODEL, // 상수 사용
      contents: prompt
    });

    console.log('Gemini API response received:', {
      hasResponse: !!response,
      hasText: !!response?.text,
      textLength: response?.text?.length || 0
    });

    if (!response) {
      throw new Error(API_ERROR_MESSAGES.GEMINI_GENERATION_FAILED);
    }

    if (!response.text) {
      throw new Error(API_ERROR_MESSAGES.GEMINI_NO_RESPONSE);
    }

    return response.text;
  } catch (error: any) {
    console.error("Error generating strategy with Gemini:", error);
    console.error("Error details:", {
      name: error?.name,
      message: error?.message,
      status: error?.status,
      code: error?.code,
      stack: error?.stack
    });

    // 더 구체적인 에러 메시지 제공
    let errorMessage = "AI 전략 생성 중 오류가 발생했습니다.";

    // 403 오류 및 API 비활성화 케이스 처리
    if (error?.status === 403) {
      const errorStr = JSON.stringify(error);

      // 프로젝트 ID 추출 시도
      let projectId = '';
      let activationUrl = '';
      try {
        const errorObj = typeof error === 'string' ? JSON.parse(error) : error;
        if (errorObj?.error?.details) {
          const details = Array.isArray(errorObj.error.details) ? errorObj.error.details : [errorObj.error.details];
          for (const detail of details) {
            if (detail?.metadata?.consumer) {
              projectId = detail.metadata.consumer.replace('projects/', '');
            }
            if (detail?.metadata?.activationUrl) {
              activationUrl = detail.metadata.activationUrl;
            }
          }
        }
        // 직접 URL에서도 추출 시도
        if (!projectId && errorStr.includes('project')) {
          const projectMatch = errorStr.match(/project[":\s]+(\d+)/);
          if (projectMatch) {
            projectId = projectMatch[1];
          }
        }
      } catch (e) {
        // 파싱 실패 시 무시
      }

      if (errorStr.includes('SERVICE_DISABLED') || errorStr.includes('Generative Language API') || errorStr.includes('has not been used') || errorStr.includes('is disabled')) {
        const projectSpecificUrl = projectId
          ? `https://console.developers.google.com/apis/api/generativelanguage.googleapis.com/overview?project=${projectId}`
          : activationUrl || 'https://console.developers.google.com/apis/api/generativelanguage.googleapis.com/overview';

        errorMessage = `⚠️ Generative Language API가 활성화되지 않았습니다.\n\n` +
          `현재 API 키는 프로젝트 ${projectId || '(알 수 없음)'}에 연결되어 있습니다.\n\n` +
          `해결 방법:\n\n` +
          `🔹 방법 1: 현재 프로젝트에서 API 활성화 (권장)\n` +
          `1. 아래 링크를 클릭하거나 복사하여 열기:\n` +
          `   ${projectSpecificUrl}\n` +
          `2. "사용 설정" 버튼 클릭\n` +
          `3. 활성화 완료 후 2-3분 대기\n` +
          `4. 앱에서 다시 시도\n\n` +
          `🔹 방법 2: Google AI Studio에서 새 키 발급 (더 쉬움)\n` +
          `1. https://aistudio.google.com/apikey 접속\n` +
          `2. "Create API Key" 클릭 (API가 자동 활성화됨)\n` +
          `3. 새 API 키를 .env.local 파일에 저장\n` +
          `4. 개발 서버 재시작\n`;
      } else if (errorStr.includes('API_KEY_INVALID') || errorStr.includes('permission denied')) {
        errorMessage = "Gemini API 키가 유효하지 않거나 권한이 없습니다. .env.local 파일의 GEMINI_API_KEY를 확인하고, Google AI Studio(https://aistudio.google.com/apikey)에서 새로 발급받으세요.";
      } else {
        errorMessage = `API 접근 권한 오류 (403): ${error.message || 'API 키 권한을 확인해주세요.'}`;
      }
    } else if (error?.message) {
      const errorMsgLower = error.message.toLowerCase();
      const errorStr = JSON.stringify(error).toLowerCase();

      if (errorStr.includes('service_disabled') || errorStr.includes('api has not been used')) {
        errorMessage = `⚠️ Generative Language API가 활성화되지 않았습니다.\n\n` +
          `Google Cloud Console에서 Generative Language API를 활성화해주세요:\n` +
          `https://console.developers.google.com/apis/api/generativelanguage.googleapis.com/overview`;
      } else if (errorMsgLower.includes('api_key') || errorMsgLower.includes('api key') || errorMsgLower.includes('authentication')) {
        errorMessage = "Gemini API 키가 유효하지 않거나 설정되지 않았습니다. .env.local 파일에 GEMINI_API_KEY를 설정하고 개발 서버를 재시작해주세요.";
      } else if (errorMsgLower.includes('quota') || errorMsgLower.includes('limit exceeded')) {
        errorMessage = "Gemini API 할당량이 초과되었습니다. 잠시 후 다시 시도해주세요.";
      } else if (errorMsgLower.includes('rate limit') || errorMsgLower.includes('rate_limit')) {
        errorMessage = "요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.";
      } else if (errorMsgLower.includes('model') || errorMsgLower.includes('invalid')) {
        errorMessage = `모델 호출 오류: ${error.message}`;
      } else if (error?.status) {
        errorMessage = `API 오류 (상태 코드: ${error.status}): ${error.message || '알 수 없는 오류'}`;
      } else {
        errorMessage = `AI 전략 생성 중 오류가 발생했습니다: ${error.message}`;
      }
    } else if (error?.status) {
      errorMessage = `API 오류 (상태 코드: ${error.status})`;
    }

    throw new Error(errorMessage);
  }
};

// 영상별 AI 요약 생성
export const generateVideoSummary = async (video: VideoData, channelTitle?: string): Promise<string> => {
  const apiKey = (process.env.API_KEY as string) || (import.meta.env?.GEMINI_API_KEY as string) || (import.meta.env?.VITE_GEMINI_API_KEY as string);

  if (!apiKey) {
    throw new Error("Gemini API 키가 설정되지 않았습니다.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
당신은 유튜브 콘텐츠 분석 전문가입니다.
다음 영상 정보를 바탕으로 간결하고 실용적인 요약을 제공해주세요.

[영상 정보]
- 제목: ${video.title}
- 조회수: ${video.viewCount.toLocaleString()}
- 좋아요: ${video.likeCount.toLocaleString()}
- 댓글: ${video.commentCount.toLocaleString()}
- 영상 길이: ${Math.floor(video.duration / 60)}분 ${video.duration % 60}초
- 인기도 점수: ${video.popularityScore}
${channelTitle ? `- 채널: ${channelTitle}` : ''}
${video.description ? `- 설명: ${video.description.substring(0, 500)}` : ''}

[요청사항]
다음 항목을 포함하여 한국어로 요약해주세요:
1. 영상의 핵심 내용 및 주요 포인트
2. 인기도가 높은 이유 분석 (제목, 내용, 형식 등)
3. 벤치마킹할 수 있는 요소 (성공 요인)
4. 개선 가능한 점 (있다면)

마크다운 형식으로 작성하고, 각 항목을 명확히 구분해주세요.
`;

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_CONFIG.DEFAULT_MODEL,
      contents: prompt
    });

    if (!response || !response.text) {
      throw new Error("AI 요약 생성에 실패했습니다.");
    }

    return response.text;
  } catch (error: any) {
    console.error("Error generating video summary:", error);
    throw new Error(error?.message || "영상 요약 생성 중 오류가 발생했습니다.");
  }
};

// 쇼츠 개선 제안 생성
export const generateShortsAdvice = async (short: ShortsData, channelInfo?: any): Promise<string> => {
  const apiKey = (process.env.API_KEY as string) || (import.meta.env?.GEMINI_API_KEY as string) || (import.meta.env?.VITE_GEMINI_API_KEY as string);

  if (!apiKey) {
    throw new Error("Gemini API 키가 설정되지 않았습니다.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const performanceLabel = {
    'VIRAL': '바이럴 (상위 10%)',
    'EXCELLENT': '우수 (상위 10-30%)',
    'GOOD': '양호 (상위 30-60%)',
    'AVERAGE': '평균 (상위 60-80%)',
    'POOR': '부진 (하위 20%)',
  }[short.performance] || '알 수 없음';

  const prompt = `
당신은 대한민국 최고의 YouTube 쇼츠(Shorts) 성장 전략 전문가입니다.
다음은 분석 대상 쇼츠의 상세 정보입니다.

[쇼츠 정보]
- 제목: ${short.title}
- 조회수: ${short.viewCount.toLocaleString()}
- 좋아요: ${short.likeCount.toLocaleString()}
- 댓글: ${short.commentCount.toLocaleString()}
- 재생 시간: ${short.duration}초
- 참여율: ${(short.engagementRate * 100).toFixed(2)}%
- 성능 등급: ${performanceLabel}
- 인기도 점수: ${short.popularityScore.toFixed(2)}
${short.hookEffectiveness ? `- 훅 효과성: ${short.hookEffectiveness.toFixed(2)}` : ''}
${short.retentionScore ? `- 예상 시청 유지율: ${(short.retentionScore * 100).toFixed(1)}%` : ''}
${channelInfo ? `- 채널: ${channelInfo.title} (구독자 ${channelInfo.subscriberCount?.toLocaleString() || 0})` : ''}
${short.description ? `- 설명:\n${short.description.substring(0, 300)}` : ''}

[업로드 날짜]
${short.publishedAt ? new Date(short.publishedAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }) : '알 수 없음'}

[요청사항]
위 데이터를 바탕으로, 이 쇼츠의 성과를 개선하고 더 많은 조회수와 참여를 끌어내기 위한 구체적이고 실행 가능한 개선 방안을 한국어로 제안해주세요.

다음 항목을 마크다운 형식으로 작성해주세요:

### 1. 현재 성과 분석
- 이 쇼츠의 강점은 무엇인가요? (조회수, 참여율, 재생시간 등 고려)
- 개선이 필요한 부분은 무엇인가요?
- 경쟁 쇼츠 대비 어느 정도 수준인가요?

### 2. 제목 최적화
- 현재 제목의 문제점 또는 개선 가능한 부분
- 더 많은 클릭을 유도할 수 있는 제목 3가지 제안 (트렌드, 감정 유발, 호기심 자극 등 고려)

### 3. 첫 3초 훅(Hook) 강화
- 쇼츠는 첫 3초가 가장 중요합니다. 시청자를 사로잡을 수 있는 오프닝 전략을 제안해주세요.
- 시각적 요소, 자막, 사운드 등을 활용한 구체적인 아이디어

### 4. 참여율 향상 전략
- 좋아요, 댓글, 공유를 늘리기 위한 CTA(Call-to-Action) 전략
- 시청자 인터랙션을 유도하는 구체적인 방법 (질문, 챌린지, 투표 등)

### 5. 알고리즘 최적화
- 해시태그 전략 제안 (인기 해시태그 + 니치 해시태그 조합)
- 업로드 최적 시간대 제안
- 시리즈화 또는 후속 쇼츠 제작 아이디어

### 6. 즉시 실행 가능한 액션 플랜
- 오늘 바로 실행할 수 있는 개선 사항 3가지 (우선순위 순)
- 각 액션의 기대 효과

응답은 간결하고 실용적으로 작성하되, 구체적인 예시를 포함해주세요.
`;

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_CONFIG.DEFAULT_MODEL,
      contents: prompt
    });

    if (!response || !response.text) {
      throw new Error("AI 개선 제안 생성에 실패했습니다.");
    }

    return response.text;
  } catch (error: any) {
    console.error("Error generating shorts advice:", error);
    throw new Error(error?.message || "쇼츠 개선 제안 생성 중 오류가 발생했습니다.");
  }
};

// 댓글 분석하여 콘텐츠 아이디어 추천
export const analyzeCommentsForIdeas = async (
  comments: any[],
  videoTitle: string,
  videoDescription?: string
): Promise<string> => {
  const apiKey = (process.env.API_KEY as string) || (import.meta.env?.GEMINI_API_KEY as string) || (import.meta.env?.VITE_GEMINI_API_KEY as string);

  if (!apiKey) {
    throw new Error("Gemini API 키가 설정되지 않았습니다.");
  }

  const ai = new GoogleGenAI({ apiKey });

  // 댓글 텍스트 추출 (상위 50개)
  const commentTexts = comments
    .slice(0, 50)
    .map(c => c.snippet?.topLevelComment?.snippet?.textDisplay || c.snippet?.textDisplay || '')
    .filter(text => text.length > 0);

  const prompt = `
당신은 대한민국 최고의 유튜브 콘텐츠 기획 전문가입니다.
다음은 인기 영상 "${videoTitle}"의 댓글 분석 데이터입니다.

[영상 정보]
- 제목: ${videoTitle}
${videoDescription ? `- 설명: ${videoDescription.substring(0, 300)}` : ''}

[수집된 댓글 (${commentTexts.length}개)]
${commentTexts.slice(0, 30).map((text, idx) => `${idx + 1}. ${text}`).join('\n')}

[요청사항]
위 댓글들을 분석하여, 시청자들이 가장 관심있어하는 주제와 니즈를 파악하고,
이를 바탕으로 새로운 콘텐츠 아이디어 3-5개를 제안해주세요.

다음 형식의 JSON 배열로 응답해주세요:
[
  {
    "id": "1",
    "title": "콘텐츠 제목",
    "description": "콘텐츠 설명 (2-3문장)",
    "reasoning": "이 아이디어를 추천하는 이유 (댓글 분석 근거 포함)",
    "estimatedInterest": "high" | "medium" | "low"
  }
]

**중요**: 반드시 유효한 JSON 형식으로만 응답하세요. 다른 텍스트는 포함하지 마세요.
`;

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_CONFIG.DEFAULT_MODEL,
      contents: prompt
    });

    if (!response || !response.text) {
      throw new Error("AI 분석 생성에 실패했습니다.");
    }

    return response.text;
  } catch (error: any) {
    console.error("Error analyzing comments:", error);
    throw new Error(error?.message || "댓글 분석 중 오류가 발생했습니다.");
  }
};

// 선택한 소재로 대본 목차 생성
export const generateScriptOutline = async (
  idea: any,
  videoContext?: string
): Promise<string> => {
  const apiKey = (process.env.API_KEY as string) || (import.meta.env?.GEMINI_API_KEY as string) || (import.meta.env?.VITE_GEMINI_API_KEY as string);

  if (!apiKey) {
    throw new Error("Gemini API 키가 설정되지 않았습니다.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
당신은 대한민국 최고의 유튜브 대본 작가입니다.
다음 콘텐츠 아이디어를 바탕으로 실제 촬영에 사용할 수 있는 상세한 대본 목차를 작성해주세요.

[콘텐츠 아이디어]
- 제목: ${idea.title}
- 설명: ${idea.description}
- 추천 이유: ${idea.reasoning}
${videoContext ? `- 참고 영상: ${videoContext}` : ''}

[요청사항]
이 아이디어를 바탕으로 10-15분 분량의 유튜브 영상 대본 목차를 작성해주세요.
각 섹션별로 예상 시간과 핵심 포인트를 포함해주세요.

다음 형식의 JSON으로 응답해주세요:
{
  "title": "최종 영상 제목 (클릭을 유도하는 매력적인 제목)",
  "estimatedDuration": "10-15분",
  "sections": [
    {
      "title": "섹션 제목",
      "estimatedTime": "2-3분",
      "keyPoints": [
        "핵심 포인트 1",
        "핵심 포인트 2",
        "핵심 포인트 3"
      ]
    }
  ]
}

**섹션 구성 가이드**:
1. 인트로 (30초-1분): 훅, 주제 소개
2. 본론 1-3개 섹션 (각 2-4분): 핵심 내용
3. 아웃트로 (1-2분): 요약, CTA

**중요**: 반드시 유효한 JSON 형식으로만 응답하세요. 다른 텍스트는 포함하지 마세요.
`;

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_CONFIG.DEFAULT_MODEL,
      contents: prompt
    });

    if (!response || !response.text) {
      throw new Error("대본 목차 생성에 실패했습니다.");
    }

    return response.text;
  } catch (error: any) {
    console.error("Error generating script outline:", error);
    throw new Error(error?.message || "대본 목차 생성 중 오류가 발생했습니다.");
  }
};
