/**
 * 공통 유틸리티 함수 모음
 */

import { VideoData, VideoTypeFilter, RegionFilter } from './types';
import {
  VIDEO_DURATION_LIMITS,
  DATE_FORMAT_OPTIONS,
  DATETIME_FORMAT_OPTIONS,
  URL_PATTERNS,
} from './constants';

// ===== 숫자 포맷팅 =====

/**
 * 숫자를 K/M 형식으로 포맷팅
 * @param num 숫자
 * @param decimals 소수점 자릿수 (기본값: 1)
 * @returns 포맷된 문자열 (예: "1.5K", "2.3M")
 *
 * @example
 * formatNumber(1500) // "1.5K"
 * formatNumber(2500000) // "2.5M"
 * formatNumber(500) // "500"
 */
export const formatNumber = (num: number, decimals: number = 1): string => {
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(decimals)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(decimals)}K`;
  }
  return num.toLocaleString();
};

/**
 * 숫자를 천 단위 구분자와 함께 포맷팅
 * @param num 숫자
 * @returns 포맷된 문자열 (예: "1,234,567")
 *
 * @example
 * formatNumberWithCommas(1234567) // "1,234,567"
 */
export const formatNumberWithCommas = (num: number): string => {
  return num.toLocaleString('ko-KR');
};

// ===== 시간 포맷팅 =====

/**
 * ISO 8601 duration 문자열을 초(seconds)로 변환
 * @param duration ISO 8601 형식의 duration 문자열 (예: "PT5M30S")
 * @returns 초 단위의 duration (없거나 잘못된 경우 0)
 *
 * @example
 * parseDuration('PT1H30M45S') // 5445 (1시간 30분 45초)
 * parseDuration('PT5M') // 300 (5분)
 * parseDuration(null) // 0
 */
export const parseDuration = (duration: string | undefined | null): number => {
  if (!duration || duration.trim() === '') return 0;

  try {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;

    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    const seconds = parseInt(match[3] || '0', 10);

    return hours * 3600 + minutes * 60 + seconds;
  } catch {
    return 0;
  }
};

/**
 * 초를 시:분:초 형식으로 변환
 * @param seconds 초
 * @returns 포맷된 문자열 (예: "1:30:45", "5:30")
 *
 * @example
 * formatDuration(5445) // "1:30:45"
 * formatDuration(330) // "5:30"
 * formatDuration(45) // "0:45"
 */
export const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${minutes}:${String(secs).padStart(2, '0')}`;
};

/**
 * 초를 읽기 쉬운 형식으로 변환
 * @param seconds 초
 * @returns 포맷된 문자열 (예: "1시간 30분", "5분 30초")
 *
 * @example
 * formatDurationReadable(5445) // "1시간 30분 45초"
 * formatDurationReadable(330) // "5분 30초"
 * formatDurationReadable(45) // "45초"
 */
export const formatDurationReadable = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}시간`);
  if (minutes > 0) parts.push(`${minutes}분`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}초`);

  return parts.join(' ');
};

// ===== 날짜 포맷팅 =====

/**
 * ISO 8601 날짜를 로케일 형식으로 변환
 * @param dateString ISO 8601 날짜 문자열
 * @returns 포맷된 날짜 (예: "2024-01-15")
 *
 * @example
 * formatDate('2024-01-15T10:30:00Z') // "2024-01-15"
 */
export const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', DATE_FORMAT_OPTIONS);
  } catch {
    return dateString;
  }
};

/**
 * ISO 8601 날짜를 날짜-시간 형식으로 변환
 * @param dateString ISO 8601 날짜 문자열
 * @returns 포맷된 날짜-시간 (예: "2024-01-15 10:30:00")
 *
 * @example
 * formatDateTime('2024-01-15T10:30:00Z') // "2024-01-15 10:30:00"
 */
export const formatDateTime = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR', DATETIME_FORMAT_OPTIONS);
  } catch {
    return dateString;
  }
};

/**
 * 날짜로부터 경과 시간을 계산
 * @param dateString ISO 8601 날짜 문자열
 * @returns 경과 시간 문자열 (예: "3일 전", "2시간 전")
 *
 * @example
 * getTimeAgo('2024-01-15T10:30:00Z') // "3일 전"
 */
export const getTimeAgo = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}일 전`;
    if (diffHours > 0) return `${diffHours}시간 전`;
    if (diffMins > 0) return `${diffMins}분 전`;
    return '방금 전';
  } catch {
    return dateString;
  }
};

// ===== 비디오 필터링 =====

/**
 * 비디오 타입별로 필터링
 * @param videos 비디오 목록
 * @param type 필터 타입
 * @param shortsMaxDuration Shorts 최대 길이 (초, 기본값: 60)
 * @returns 필터링된 비디오 목록
 *
 * @example
 * filterByVideoType(videos, VideoTypeFilter.SHORTS) // Shorts만 반환
 * filterByVideoType(videos, VideoTypeFilter.LONG) // 긴 영상만 반환
 */
export const filterByVideoType = (
  videos: VideoData[],
  type: VideoTypeFilter,
  shortsMaxDuration: number = VIDEO_DURATION_LIMITS.SHORTS_MAX_SECONDS
): VideoData[] => {
  switch (type) {
    case VideoTypeFilter.SHORTS:
      return videos.filter(v => v.duration > 0 && v.duration <= shortsMaxDuration);
    case VideoTypeFilter.LONG:
      return videos.filter(v => v.duration > shortsMaxDuration);
    case VideoTypeFilter.ALL:
    default:
      return videos;
  }
};

/**
 * 지역별로 필터링 (제목 기반)
 * @param videos 비디오 목록
 * @param region 지역 필터
 * @returns 필터링된 비디오 목록
 *
 * @example
 * filterByRegion(videos, RegionFilter.KOREA) // 한글 제목만
 * filterByRegion(videos, RegionFilter.OVERSEAS) // 비한글 제목만
 */
export const filterByRegion = (
  videos: VideoData[],
  region: RegionFilter
): VideoData[] => {
  const hasKorean = (text: string): boolean => /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(text);

  switch (region) {
    case RegionFilter.KOREA:
      return videos.filter(v => hasKorean(v.title));
    case RegionFilter.OVERSEAS:
      return videos.filter(v => !hasKorean(v.title));
    default:
      return videos;
  }
};

// ===== URL 파싱 =====

/**
 * YouTube URL에서 채널 정보 추출
 * @param url YouTube URL
 * @returns 채널 ID, Handle, 또는 null
 *
 * @example
 * parseChannelUrl('https://youtube.com/channel/UCxxx') // { channelId: 'UCxxx' }
 * parseChannelUrl('https://youtube.com/@channelname') // { handle: 'channelname' }
 */
export const parseChannelUrl = (
  url: string
): { channelId?: string; handle?: string } | null => {
  try {
    const channelIdMatch = url.match(URL_PATTERNS.CHANNEL_ID);
    if (channelIdMatch) {
      return { channelId: channelIdMatch[1] };
    }

    const handleMatch = url.match(URL_PATTERNS.CHANNEL_HANDLE);
    if (handleMatch) {
      return { handle: handleMatch[1] };
    }

    return null;
  } catch {
    return null;
  }
};

/**
 * YouTube URL에서 비디오 ID 추출
 * @param url YouTube URL
 * @returns 비디오 ID 또는 null
 *
 * @example
 * parseVideoUrl('https://youtube.com/watch?v=dQw4w9WgXcQ') // 'dQw4w9WgXcQ'
 * parseVideoUrl('https://youtu.be/dQw4w9WgXcQ') // 'dQw4w9WgXcQ'
 */
export const parseVideoUrl = (url: string): string | null => {
  try {
    const videoMatch = url.match(URL_PATTERNS.VIDEO_ID);
    if (videoMatch) return videoMatch[1];

    const shortsMatch = url.match(URL_PATTERNS.SHORTS_ID);
    if (shortsMatch) return shortsMatch[1];

    return null;
  } catch {
    return null;
  }
};

// ===== 데이터 검증 =====

/**
 * 비디오 데이터 유효성 검증
 * @param video 비디오 데이터
 * @returns 유효 여부
 */
export const isValidVideoData = (video: VideoData): boolean => {
  return Boolean(
    video.id &&
    video.title &&
    typeof video.viewCount === 'number' &&
    typeof video.likeCount === 'number' &&
    typeof video.commentCount === 'number'
  );
};

/**
 * API 키 유효성 기본 검증
 * @param apiKey API 키
 * @returns 유효 여부
 */
export const isValidApiKey = (apiKey: string): boolean => {
  return Boolean(apiKey && apiKey.trim().length > 0 && apiKey.startsWith('AIza'));
};

// ===== 배열 유틸리티 =====

/**
 * 배열을 지정된 크기로 청크 분할
 * @param array 배열
 * @param size 청크 크기
 * @returns 청크 배열
 *
 * @example
 * chunkArray([1,2,3,4,5], 2) // [[1,2], [3,4], [5]]
 */
export const chunkArray = <T>(array: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

/**
 * 배열에서 중복 제거 (객체 배열용, 키 기반)
 * @param array 배열
 * @param key 중복 체크할 키
 * @returns 중복이 제거된 배열
 *
 * @example
 * uniqueBy([{id:1},{id:2},{id:1}], 'id') // [{id:1},{id:2}]
 */
export const uniqueBy = <T, K extends keyof T>(array: T[], key: K): T[] => {
  const seen = new Set<T[K]>();
  return array.filter(item => {
    const value = item[key];
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
};

// ===== CSV 유틸리티 =====

/**
 * CSV 셀 값 이스케이프 (쉼표, 따옴표, 개행 처리)
 * @param value 셀 값
 * @returns 이스케이프된 값
 */
export const escapeCsvValue = (value: string | number): string => {
  const strValue = String(value);
  if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
    return `"${strValue.replace(/"/g, '""')}"`;
  }
  return strValue;
};

/**
 * 데이터를 CSV 형식으로 변환
 * @param data 데이터 배열
 * @param headers 헤더 배열
 * @returns CSV 문자열
 *
 * @example
 * convertToCSV([{name:'A',age:20}], ['name','age']) // "name,age\nA,20"
 */
export const convertToCSV = <T extends Record<string, any>>(
  data: T[],
  headers: (keyof T)[]
): string => {
  const headerRow = headers.map(h => String(h)).join(',');
  const dataRows = data.map(row =>
    headers.map(h => escapeCsvValue(row[h] ?? '')).join(',')
  );
  return [headerRow, ...dataRows].join('\n');
};

// ===== 에러 처리 =====

/**
 * 에러 객체에서 읽기 쉬운 메시지 추출
 * @param error 에러 객체
 * @param defaultMessage 기본 메시지
 * @returns 에러 메시지
 */
export const extractErrorMessage = (
  error: unknown,
  defaultMessage: string = '알 수 없는 오류가 발생했습니다.'
): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  return defaultMessage;
};

// ===== 디바운스/스로틀 =====

/**
 * 디바운스 함수 생성
 * @param func 실행할 함수
 * @param wait 대기 시간 (밀리초)
 * @returns 디바운스된 함수
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

/**
 * 스로틀 함수 생성
 * @param func 실행할 함수
 * @param limit 최소 간격 (밀리초)
 * @returns 스로틀된 함수
 */
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean = false;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

// ===== 로컬스토리지 유틸리티 =====

/**
 * 로컬스토리지에 안전하게 저장
 * @param key 키
 * @param value 값
 * @returns 성공 여부
 */
export const safeLocalStorageSet = (key: string, value: any): boolean => {
  try {
    const serialized = JSON.stringify(value);
    window.localStorage.setItem(key, btoa(serialized));
    return true;
  } catch (error) {
    console.error('Failed to save to localStorage:', error);
    return false;
  }
};

/**
 * 로컬스토리지에서 안전하게 읽기
 * @param key 키
 * @param defaultValue 기본값
 * @returns 저장된 값 또는 기본값
 */
export const safeLocalStorageGet = <T>(key: string, defaultValue: T): T => {
  try {
    const item = window.localStorage.getItem(key);
    if (!item) return defaultValue;
    const decoded = atob(item);
    return JSON.parse(decoded) as T;
  } catch (error) {
    console.error('Failed to read from localStorage:', error);
    return defaultValue;
  }
};
