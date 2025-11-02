import { GoogleGenAI } from "@google/genai";
import { AnalysisResult, ChannelAnalysisView } from '../types';

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

export const generateStrategy = async (
  analysisResult: AnalysisResult, 
  query: string, 
  type: string, 
  channelView?: ChannelAnalysisView | null
): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error("Gemini API key is not set in environment variables.");
  }
  
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  let prompt = '';
  if (type === 'CHANNEL') {
    if (channelView === ChannelAnalysisView.TOP) {
      prompt = getTopVideosPrompt(analysisResult, query);
    } else {
      prompt = getBottomVideosPrompt(analysisResult, query);
    }
  } else {
    prompt = getKeywordPrompt(analysisResult, query);
  }


  try {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
    });
    return response.text;
  } catch (error) {
    console.error("Error generating strategy with Gemini:", error);
    return "AI 전략 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
  }
};