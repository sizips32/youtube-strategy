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
