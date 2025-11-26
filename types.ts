export interface VideoData {
  id: string;
  title: string;
  thumbnail: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  duration: number; // in seconds
  popularityScore: number;
  publishedAt?: string;
  description?: string;
  channelId?: string;
  channelTitle?: string;
}

export interface ChannelInfo {
  id: string;
  title: string;
  thumbnail: string;
  subscriberCount?: number;
  totalViewCount?: number;
  videoCount?: number;
  publishedAt?: string;
}

export interface AnalysisResult {
  channelInfo: ChannelInfo | null;
  videos: VideoData[];
}

export enum AnalysisType {
  CHANNEL = 'CHANNEL',
  KEYWORD = 'KEYWORD',
  RISING_STAR = 'RISING_STAR', // 라이징 스타 찾기
  BLUE_OCEAN = 'BLUE_OCEAN', // 빈집 토픽 분석
  SHORTS_MANAGEMENT = 'SHORTS_MANAGEMENT', // 쇼츠 관리
  CONTENT_DISCOVERY = 'CONTENT_DISCOVERY', // 소재 발굴
}

// 소재 발굴 관련 타입
export interface ContentDiscoveryVideo extends VideoData {
  channelSubscriberCount: number;
  subscriberViewRatio: number; // 구독자 대비 조회수 비율
}

export interface VideoComment {
  id: string;
  author: string;
  text: string;
  likeCount: number;
  publishedAt: string;
}

export interface ContentIdea {
  id: string;
  title: string;
  description: string;
  reasoning: string; // AI가 추천한 이유
  estimatedInterest: 'high' | 'medium' | 'low'; // 예상 관심도
}

export interface ScriptOutline {
  title: string;
  estimatedDuration: string; // 예: "10-15분"
  sections: {
    title: string;
    estimatedTime: string; // 예: "2-3분"
    keyPoints: string[];
  }[];
}

export enum ChannelAnalysisView {
  TOP = 'TOP',
  BOTTOM = 'BOTTOM',
}

export enum RegionFilter {
  KOREA = 'KOREA',
  OVERSEAS = 'OVERSEAS',
}

export enum VideoTypeFilter {
  ALL = 'ALL',
  SHORTS = 'SHORTS', // under 3 mins
  LONG = 'LONG',   // over 3 mins
}

// Shorts 관리 관련 타입
export enum ShortsPerformance {
  VIRAL = 'VIRAL',       // 바이럴 (상위 10%)
  EXCELLENT = 'EXCELLENT', // 우수 (상위 10-30%)
  GOOD = 'GOOD',         // 양호 (상위 30-60%)
  AVERAGE = 'AVERAGE',   // 평균 (상위 60-80%)
  POOR = 'POOR',         // 부진 (하위 20%)
}

export interface ShortsData extends VideoData {
  performance: ShortsPerformance;
  engagementRate: number; // (likes + comments) / views
  retentionScore?: number; // 예상 시청 유지율 (조회수/구독자 비율로 추정)
  hookEffectiveness?: number; // 첫 3초 효과성 (조회수 대비 인게이지먼트)
}

export interface ShortsAnalysisResult {
  channelInfo: ChannelInfo | null;
  videos: ShortsData[];
  summary: ShortsSummary;
}

export interface ShortsSummary {
  totalShorts: number;
  avgViews: number;
  avgEngagement: number;
  viralCount: number;
  poorCount: number;
  bestPerformer: ShortsData | null;
  worstPerformer: ShortsData | null;
  recommendations: string[];
}

export interface ShortsEditSuggestion {
  videoId: string;
  title: string;
  suggestions: {
    type: 'title' | 'thumbnail' | 'description' | 'hashtags' | 'timing';
    current: string;
    suggested: string;
    reason: string;
  }[];
}
