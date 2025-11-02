export interface VideoData {
  id: string;
  title: string;
  thumbnail: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  duration: number; // in seconds
  popularityScore: number;
}

export interface ChannelInfo {
  id: string;
  title: string;
  thumbnail: string;
}

export interface AnalysisResult {
  channelInfo: ChannelInfo | null;
  videos: VideoData[];
}

export enum AnalysisType {
  CHANNEL = 'CHANNEL',
  KEYWORD = 'KEYWORD',
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