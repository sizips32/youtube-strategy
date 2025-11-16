/**
 * 애플리케이션 전역 상수 정의
 */

// ===== 비디오 관련 상수 =====

/**
 * 비디오 길이 제한 (초 단위)
 */
export const VIDEO_DURATION_LIMITS = {
  /** YouTube Shorts 최대 길이 (60초 = 1분) */
  SHORTS_MAX_SECONDS: 60,

  /** Shorts 확장 기준 (180초 = 3분) - 일부 플랫폼에서 사용 */
  SHORTS_EXTENDED_MAX_SECONDS: 180,
} as const;

/**
 * 비디오 검색 및 분석 제한
 */
export const VIDEO_QUERY_LIMITS = {
  /** 기본 검색 결과 수 */
  DEFAULT_MAX_RESULTS: 10,

  /** 채널 비디오 최대 조회 수 */
  CHANNEL_VIDEOS_MAX: 50,

  /** 키워드 검색 최대 결과 */
  KEYWORD_SEARCH_MAX: 50,

  /** 라이징 스타 채널 검색 수 */
  RISING_STAR_CHANNELS: 20,

  /** 배치 처리 크기 (YouTube API는 한 번에 50개까지) */
  BATCH_SIZE: 50,
} as const;

// ===== 인기도 점수 계산 =====

/**
 * 인기도 점수 계산 가중치
 */
export const POPULARITY_WEIGHTS = {
  /** 좋아요 가중치 (60%) */
  LIKE_WEIGHT: 0.6,

  /** 댓글 가중치 (40%) */
  COMMENT_WEIGHT: 0.4,

  /** 점수 스케일링 배수 (0~1000 범위로 정규화) */
  SCORE_MULTIPLIER: 1000,
} as const;

/**
 * 인기도 점수 계산 함수
 * @param viewCount 조회수
 * @param likeCount 좋아요 수
 * @param commentCount 댓글 수
 * @returns 0~1000 범위의 인기도 점수
 */
export const calculatePopularityScore = (
  viewCount: number,
  likeCount: number,
  commentCount: number
): number => {
  if (viewCount === 0) return 0;

  const engagementRate = (
    likeCount * POPULARITY_WEIGHTS.LIKE_WEIGHT +
    commentCount * POPULARITY_WEIGHTS.COMMENT_WEIGHT
  ) / viewCount;

  return engagementRate * POPULARITY_WEIGHTS.SCORE_MULTIPLIER;
};

// ===== Shorts 성과 기준 =====

/**
 * Shorts 성과 등급 임계값
 */
export const SHORTS_PERFORMANCE_THRESHOLDS = {
  /** 바이럴 (조회수 100만 이상) */
  VIRAL_VIEWS: 1_000_000,

  /** 우수 (조회수 10만 이상) */
  EXCELLENT_VIEWS: 100_000,

  /** 좋음 (조회수 1만 이상) */
  GOOD_VIEWS: 10_000,

  /** 보통 (조회수 1천 이상) */
  AVERAGE_VIEWS: 1_000,

  /** 우수 참여율 (10% 이상) */
  EXCELLENT_ENGAGEMENT: 0.10,

  /** 좋은 참여율 (5% 이상) */
  GOOD_ENGAGEMENT: 0.05,

  /** 보통 참여율 (2% 이상) */
  AVERAGE_ENGAGEMENT: 0.02,
} as const;

// ===== 채널 분석 기준 =====

/**
 * 라이징 스타 채널 기준
 */
export const RISING_STAR_CRITERIA = {
  /** 최소 구독자 수 */
  MIN_SUBSCRIBERS: 1_000,

  /** 최대 구독자 수 */
  MAX_SUBSCRIBERS: 100_000,

  /** 최소 비디오 수 */
  MIN_VIDEO_COUNT: 5,

  /** 최소 평균 조회수 */
  MIN_AVERAGE_VIEWS: 1_000,
} as const;

// ===== API 설정 =====

/**
 * Gemini AI 모델 설정
 */
export const GEMINI_CONFIG = {
  /** 기본 모델 */
  DEFAULT_MODEL: 'gemini-2.0-flash-exp',

  /** 대체 모델 (비용 절감) */
  FALLBACK_MODEL: 'gemini-1.5-flash',

  /** 프리미엄 모델 (더 나은 품질) */
  PREMIUM_MODEL: 'gemini-2.0-flash-001',
} as const;

/**
 * YouTube API 설정
 */
export const YOUTUBE_API_CONFIG = {
  /** API 버전 */
  VERSION: 'v3',

  /** Base URL */
  BASE_URL: 'https://www.googleapis.com/youtube/v3',

  /** 최대 재시도 횟수 */
  MAX_RETRIES: 3,

  /** 재시도 대기 시간 (밀리초) */
  RETRY_DELAY_MS: 1000,
} as const;

// ===== 에러 메시지 =====

/**
 * API 에러 메시지
 */
export const API_ERROR_MESSAGES = {
  // YouTube API 에러
  YOUTUBE_API_NOT_ENABLED: 'YouTube Data API가 활성화되지 않았습니다.',
  YOUTUBE_INVALID_KEY: 'YouTube API 키가 유효하지 않습니다.',
  YOUTUBE_QUOTA_EXCEEDED: 'YouTube API 할당량을 초과했습니다.',
  YOUTUBE_CHANNEL_NOT_FOUND: '채널을 찾을 수 없습니다.',
  YOUTUBE_NO_VIDEOS: '채널에 영상이 없습니다.',
  YOUTUBE_FETCH_FAILED: '영상 정보를 가져올 수 없습니다.',

  // Gemini API 에러
  GEMINI_API_NOT_ENABLED: 'Generative Language API가 활성화되지 않았습니다.',
  GEMINI_INVALID_KEY: 'Gemini API 키가 유효하지 않습니다.',
  GEMINI_QUOTA_EXCEEDED: 'Gemini API 할당량을 초과했습니다.',
  GEMINI_GENERATION_FAILED: 'AI 분석 생성에 실패했습니다.',
  GEMINI_NO_RESPONSE: 'Gemini API 응답에 텍스트 데이터가 없습니다.',

  // 일반 에러
  NETWORK_ERROR: '네트워크 오류가 발생했습니다.',
  UNKNOWN_ERROR: '알 수 없는 오류가 발생했습니다.',
  INVALID_INPUT: '입력값이 올바르지 않습니다.',
} as const;

// ===== UI 설정 =====

/**
 * CSV 다운로드 설정
 */
export const CSV_CONFIG = {
  /** 파일명 접두사 */
  FILENAME_PREFIX: 'youtube_analysis',

  /** 파일 확장자 */
  FILE_EXTENSION: '.csv',

  /** BOM (UTF-8 with BOM for Excel compatibility) */
  BOM: '\uFEFF',
} as const;

/**
 * 로딩 및 디바운스 설정
 */
export const UI_CONFIG = {
  /** 검색 디바운스 시간 (밀리초) */
  SEARCH_DEBOUNCE_MS: 500,

  /** 스크롤 디바운스 시간 (밀리초) */
  SCROLL_DEBOUNCE_MS: 100,

  /** 토스트 표시 시간 (밀리초) */
  TOAST_DURATION_MS: 3000,
} as const;

// ===== 정규 표현식 =====

/**
 * URL 파싱 정규식
 */
export const URL_PATTERNS = {
  /** YouTube 채널 ID 패턴 */
  CHANNEL_ID: /\/channel\/([a-zA-Z0-9_-]+)/,

  /** YouTube 채널 Handle 패턴 (@handle) */
  CHANNEL_HANDLE: /\/@([a-zA-Z0-9_-]+)/,

  /** YouTube 비디오 ID 패턴 */
  VIDEO_ID: /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,

  /** YouTube Shorts ID 패턴 */
  SHORTS_ID: /\/shorts\/([a-zA-Z0-9_-]{11})/,
} as const;

// ===== 날짜 형식 =====

/**
 * 날짜 포맷 옵션
 */
export const DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
} as const;

/**
 * 날짜-시간 포맷 옵션
 */
export const DATETIME_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
} as const;
