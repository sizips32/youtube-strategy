import { ChannelInfo, VideoData, ShortsData, ShortsPerformance, ShortsSummary } from '../types';
import {
  YOUTUBE_API_CONFIG,
  API_ERROR_MESSAGES,
  VIDEO_QUERY_LIMITS,
  VIDEO_DURATION_LIMITS,
  RISING_STAR_CRITERIA,
  calculatePopularityScore,
} from '../constants';
import {
  parseDuration,
  parseChannelUrl as parseChannelUrlUtil,
  uniqueBy,
  chunkArray,
  extractErrorMessage,
} from '../utils';

const API_BASE_URL = YOUTUBE_API_CONFIG.BASE_URL;


export const testApiKey = async (apiKey: string): Promise<{ success: boolean; message?: string }> => {
  try {
    const response = await fetch(`${API_BASE_URL}/search?part=snippet&q=test&key=${apiKey}`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData?.error?.message || `HTTP ${response.status}`;

      // 403 오류는 API가 비활성화되었을 가능성
      if (response.status === 403) {
        const errorStr = JSON.stringify(errorData);
        if (errorStr.includes('API has not been used') || errorStr.includes('is disabled') || errorStr.includes('SERVICE_DISABLED')) {
          return {
            success: false,
            message: `YouTube Data API v3가 활성화되지 않았습니다.\n\n` +
              `해결 방법:\n` +
              `1. https://console.developers.google.com/apis/api/youtube.googleapis.com/overview 에서 API를 활성화하세요.\n` +
              `2. API 활성화 후 몇 분 기다린 후 다시 시도하세요.`
          };
        } else if (errorStr.includes('API key not valid') || errorStr.includes('keyInvalid')) {
          return {
            success: false,
            message: 'API 키가 유효하지 않습니다. 올바른 YouTube Data API v3 키를 입력해주세요.'
          };
        } else if (errorStr.includes('quota') || errorStr.includes('Quota')) {
          return {
            success: false,
            message: 'YouTube API 할당량이 초과되었습니다. 잠시 후 다시 시도해주세요.'
          };
        }
      }

      return {
        success: false,
        message: `YouTube API 오류: ${errorMessage}`
      };
    }

    return { success: true };
  } catch (error: any) {
    console.error('API Key test failed:', error);
    return {
      success: false,
      message: `연결 실패: ${error.message || '알 수 없는 오류'}`
    };
  }
};

/**
 * 유튜브 채널 URL에서 채널 ID, 커스텀 URL, 또는 핸들을 추출합니다.
 * @param urlOrName 채널 URL 또는 채널명
 * @returns { channelId: string | null, searchQuery: string | null }
 *          - channelId: URL에서 직접 추출한 채널 ID (있으면)
 *          - searchQuery: 검색에 사용할 쿼리 (채널명, 커스텀 URL, 핸들)
 */
export const parseChannelUrl = (urlOrName: string): { channelId: string | null; searchQuery: string | null } => {
  // URL 형식이 아닌 경우 (일반 채널명)
  if (!urlOrName.includes('youtube.com') && !urlOrName.includes('youtu.be')) {
    return { channelId: null, searchQuery: urlOrName };
  }

  try {
    const url = new URL(urlOrName.startsWith('http') ? urlOrName : `https://${urlOrName}`);

    // 채널 ID 형식: /channel/UCxxxxx
    const channelIdMatch = url.pathname.match(/^\/channel\/([^\/]+)/);
    if (channelIdMatch) {
      return { channelId: channelIdMatch[1], searchQuery: null };
    }

    // 커스텀 URL 형식: /c/ChannelName 또는 /user/ChannelName
    const customUrlMatch = url.pathname.match(/^\/(?:c|user)\/([^\/]+)/);
    if (customUrlMatch) {
      return { channelId: null, searchQuery: customUrlMatch[1] };
    }

    // 핸들 형식: /@ChannelHandle
    const handleMatch = url.pathname.match(/^\/@([^\/]+)/);
    if (handleMatch) {
      return { channelId: null, searchQuery: `@${handleMatch[1]}` };
    }

    // URL이지만 형식을 인식하지 못한 경우, 전체 URL을 검색 쿼리로 사용
    return { channelId: null, searchQuery: urlOrName };
  } catch (e) {
    // URL 파싱 실패 시 원본을 검색 쿼리로 사용
    return { channelId: null, searchQuery: urlOrName };
  }
};

/**
 * 채널 ID로 직접 채널 정보를 가져옵니다.
 */
export const getChannelById = async (apiKey: string, channelId: string): Promise<ChannelInfo | null> => {
  const url = `${API_BASE_URL}/channels?part=snippet,statistics&id=${channelId}&key=${apiKey}`;
  const response = await fetch(url);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error.message || 'Failed to fetch channel by ID.');
  }
  const data = await response.json();
  if (!data.items || data.items.length === 0) return null;

  const item = data.items[0];
  const stats = item.statistics || {};

  return {
    id: channelId,
    title: item.snippet.title,
    thumbnail: item.snippet.thumbnails.default.url,
    subscriberCount: parseInt(stats.subscriberCount || '0', 10),
    totalViewCount: parseInt(stats.viewCount || '0', 10),
    videoCount: parseInt(stats.videoCount || '0', 10),
    publishedAt: item.snippet.publishedAt,
  };
};

export const searchChannel = async (apiKey: string, channelName: string): Promise<ChannelInfo | null> => {
  // URL인지 확인하고 파싱
  const { channelId, searchQuery } = parseChannelUrl(channelName);

  // 채널 ID가 직접 추출된 경우
  if (channelId) {
    return await getChannelById(apiKey, channelId);
  }

  // 검색 쿼리가 있는 경우 (커스텀 URL, 핸들, 또는 일반 채널명)
  const searchTerm = searchQuery || channelName;
  const url = `${API_BASE_URL}/search?part=snippet&q=${encodeURIComponent(searchTerm)}&type=channel&maxResults=1&key=${apiKey}`;
  const response = await fetch(url);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error.message || 'Failed to search for channel.');
  }
  const data = await response.json();
  if (data.items.length === 0) return null;

  const channel = data.items[0];
  const foundChannelId = channel.id.channelId;

  // 채널 통계 정보 가져오기
  const statsUrl = `${API_BASE_URL}/channels?part=snippet,statistics&id=${foundChannelId}&key=${apiKey}`;
  const statsResponse = await fetch(statsUrl);
  if (statsResponse.ok) {
    const statsData = await statsResponse.json();
    if (statsData.items && statsData.items.length > 0) {
      const stats = statsData.items[0];
      return {
        id: foundChannelId,
        title: channel.snippet.title,
        thumbnail: channel.snippet.thumbnails.default.url,
        subscriberCount: parseInt(stats.statistics?.subscriberCount || '0', 10),
        totalViewCount: parseInt(stats.statistics?.viewCount || '0', 10),
        videoCount: parseInt(stats.statistics?.videoCount || '0', 10),
        publishedAt: stats.snippet?.publishedAt,
      };
    }
  }

  return {
    id: foundChannelId,
    title: channel.snippet.title,
    thumbnail: channel.snippet.thumbnails.default.url,
  };
};

export const getChannelVideos = async (apiKey: string, channelId: string, lang: string): Promise<any[]> => {
  const url = `${API_BASE_URL}/search?part=snippet&channelId=${channelId}&order=date&maxResults=${VIDEO_QUERY_LIMITS.CHANNEL_VIDEOS_MAX}&type=video&relevanceLanguage=${lang}&key=${apiKey}`;
  const response = await fetch(url);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error.message || API_ERROR_MESSAGES.YOUTUBE_FETCH_FAILED);
  }
  const data = await response.json();
  return data.items;
};

export const searchKeywordVideos = async (apiKey: string, keyword: string, lang: string): Promise<any[]> => {
  const url = `${API_BASE_URL}/search?part=snippet&q=${encodeURIComponent(keyword)}&order=relevance&maxResults=${VIDEO_QUERY_LIMITS.KEYWORD_SEARCH_MAX}&type=video&relevanceLanguage=${lang}&key=${apiKey}`;
  const response = await fetch(url);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error.message || API_ERROR_MESSAGES.YOUTUBE_FETCH_FAILED);
  }
  const data = await response.json();
  return data.items;
};

export const getVideoDetails = async (apiKey: string, videoIds: string[]): Promise<VideoData[]> => {
  if (videoIds.length === 0) return [];
  const url = `${API_BASE_URL}/videos?part=snippet,statistics,contentDetails&id=${videoIds.join(',')}&key=${apiKey}`;
  const response = await fetch(url);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error.message || API_ERROR_MESSAGES.YOUTUBE_FETCH_FAILED);
  }
  const data = await response.json();

  return data.items.map((item: any) => {
    const viewCount = parseInt(item.statistics.viewCount || '0', 10);
    const likeCount = parseInt(item.statistics.likeCount || '0', 10);
    const commentCount = parseInt(item.statistics.commentCount || '0', 10);

    // 상수 파일의 인기도 점수 계산 함수 사용
    const score = calculatePopularityScore(viewCount, likeCount, commentCount);

    return {
      id: item.id,
      title: item.snippet.title,
      thumbnail: item.snippet.thumbnails.default.url,
      viewCount,
      likeCount,
      commentCount,
      duration: parseDuration(item.contentDetails.duration),
      popularityScore: parseFloat(score.toFixed(2)),
      publishedAt: item.snippet.publishedAt,
      description: item.snippet.description || '',
      channelId: item.snippet.channelId,
      channelTitle: item.snippet.channelTitle,
    };
  });
};

// 라이징 스타 찾기: 최근 인기 급상승 채널 찾기
export const findRisingStarChannels = async (apiKey: string, keyword: string, lang: string): Promise<ChannelInfo[]> => {
  // 최근 30일 내 업로드된 영상 중 인기 영상 검색
  const publishedAfter = new Date();
  publishedAfter.setDate(publishedAfter.getDate() - 30);
  const publishedAfterISO = publishedAfter.toISOString();

  const url = `${API_BASE_URL}/search?part=snippet&q=${encodeURIComponent(keyword)}&order=viewCount&type=video&publishedAfter=${publishedAfterISO}&maxResults=${VIDEO_QUERY_LIMITS.KEYWORD_SEARCH_MAX}&relevanceLanguage=${lang}&key=${apiKey}`;
  const response = await fetch(url);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error.message || API_ERROR_MESSAGES.YOUTUBE_FETCH_FAILED);
  }
  const data = await response.json();

  // 채널 ID 중복 제거 및 통계 수집
  const channelMap = new Map<string, { channelId: string; videoCount: number; thumbnail: string; title: string }>();

  for (const item of data.items) {
    const channelId = item.snippet.channelId;
    const existing = channelMap.get(channelId);
    if (existing) {
      existing.videoCount += 1;
    } else {
      channelMap.set(channelId, {
        channelId,
        videoCount: 1,
        thumbnail: item.snippet.thumbnails.default.url,
        title: item.snippet.channelTitle,
      });
    }
  }

  // 각 채널의 통계 정보 가져오기
  const channelIds = Array.from(channelMap.keys());
  const channelsInfo: ChannelInfo[] = [];

  // 채널 통계 API 호출 (배치 처리)
  const batches = chunkArray(channelIds, VIDEO_QUERY_LIMITS.BATCH_SIZE);

  for (const batch of batches) {
    const statsUrl = `${API_BASE_URL}/channels?part=snippet,statistics&id=${batch.join(',')}&key=${apiKey}`;
    const statsResponse = await fetch(statsUrl);
    if (statsResponse.ok) {
      const statsData = await statsResponse.json();
      for (const channel of statsData.items) {
        const channelData = channelMap.get(channel.id);
        if (channelData) {
          const subscriberCount = parseInt(channel.statistics?.subscriberCount || '0', 10);
          const videoCount = parseInt(channel.statistics?.videoCount || '0', 10);
          const totalViewCount = parseInt(channel.statistics?.viewCount || '0', 10);

          // 라이징 스타 기준 적용 (상수 사용)
          if (
            subscriberCount >= RISING_STAR_CRITERIA.MIN_SUBSCRIBERS &&
            subscriberCount < RISING_STAR_CRITERIA.MAX_SUBSCRIBERS &&
            videoCount >= RISING_STAR_CRITERIA.MIN_VIDEO_COUNT
          ) {
            channelsInfo.push({
              id: channel.id,
              title: channelData.title,
              thumbnail: channelData.thumbnail,
              subscriberCount,
              totalViewCount,
              videoCount,
              publishedAt: channel.snippet?.publishedAt,
            });
          }
        }
      }
    }
  }

  // 구독자 수 기준 정렬 (적은 구독자지만 최근 활발한 채널 우선)
  return channelsInfo
    .sort((a, b) => {
      // 구독자 대비 최근 영상 수로 점수 계산
      const scoreA = (a.videoCount || 0) / Math.max(a.subscriberCount || 1, 1);
      const scoreB = (b.videoCount || 0) / Math.max(b.subscriberCount || 1, 1);
      return scoreB - scoreA;
    })
    .slice(0, VIDEO_QUERY_LIMITS.DEFAULT_MAX_RESULTS);
};

// 쇼츠 성능 분석
export const analyzeShortsPerformance = (
  videos: VideoData[],
  subscriberCount?: number
): ShortsData[] => {
  // 쇼츠만 필터링 (상수 사용)
  const shorts = videos.filter(v => v.duration > 0 && v.duration <= VIDEO_DURATION_LIMITS.SHORTS_MAX_SECONDS);

  if (shorts.length === 0) return [];

  // 참여율 계산 및 ShortsData로 변환
  const shortsWithEngagement = shorts.map(video => {
    const engagementRate = video.viewCount > 0
      ? (video.likeCount + video.commentCount) / video.viewCount
      : 0;

    // 시청 유지율 추정 (구독자 대비 조회수)
    const retentionScore = subscriberCount && subscriberCount > 0
      ? Math.min(video.viewCount / subscriberCount, 1)
      : undefined;

    // 훅 효과성 (조회수 대비 인게이지먼트 - 높을수록 첫 3초가 효과적)
    const hookEffectiveness = video.viewCount > 0
      ? ((video.likeCount + video.commentCount * 2) / video.viewCount) * 100
      : 0;

    return {
      ...video,
      engagementRate,
      retentionScore,
      hookEffectiveness,
      performance: ShortsPerformance.AVERAGE, // 임시, 나중에 계산
    };
  });

  // 참여율 기준으로 정렬하여 백분위수 계산
  const sortedByEngagement = [...shortsWithEngagement].sort(
    (a, b) => b.engagementRate - a.engagementRate
  );

  // 성능 등급 부여
  return shortsWithEngagement.map(short => {
    const rank = sortedByEngagement.findIndex(s => s.id === short.id);
    const percentile = (rank / sortedByEngagement.length) * 100;

    let performance: ShortsPerformance;
    if (percentile < 10) {
      performance = ShortsPerformance.VIRAL;
    } else if (percentile < 30) {
      performance = ShortsPerformance.EXCELLENT;
    } else if (percentile < 60) {
      performance = ShortsPerformance.GOOD;
    } else if (percentile < 80) {
      performance = ShortsPerformance.AVERAGE;
    } else {
      performance = ShortsPerformance.POOR;
    }

    return {
      ...short,
      performance,
    };
  });
};

// 쇼츠 요약 정보 생성
export const generateShortsSummary = (shorts: ShortsData[]): ShortsSummary => {
  if (shorts.length === 0) {
    return {
      totalShorts: 0,
      avgViews: 0,
      avgEngagement: 0,
      viralCount: 0,
      poorCount: 0,
      bestPerformer: null,
      worstPerformer: null,
      recommendations: ['채널에 쇼츠가 없습니다. 쇼츠를 업로드하여 시청자와 소통해보세요!'],
    };
  }

  const totalViews = shorts.reduce((sum, s) => sum + s.viewCount, 0);
  const totalEngagement = shorts.reduce((sum, s) => sum + s.engagementRate, 0);
  const avgViews = totalViews / shorts.length;
  const avgEngagement = totalEngagement / shorts.length;

  const viralCount = shorts.filter(s => s.performance === ShortsPerformance.VIRAL).length;
  const excellentCount = shorts.filter(s => s.performance === ShortsPerformance.EXCELLENT).length;
  const poorCount = shorts.filter(s => s.performance === ShortsPerformance.POOR).length;

  const sortedByViews = [...shorts].sort((a, b) => b.viewCount - a.viewCount);
  const bestPerformer = sortedByViews[0];
  const worstPerformer = sortedByViews[sortedByViews.length - 1];

  // AI 추천사항 생성
  const recommendations: string[] = [];

  // 바이럴률 분석
  const viralRate = (viralCount / shorts.length) * 100;
  if (viralRate < 5) {
    recommendations.push(
      '바이럴 쇼츠 비율이 낮습니다. 더 강력한 훅(처음 3초)과 트렌디한 주제를 시도해보세요.'
    );
  } else if (viralRate > 15) {
    recommendations.push(
      `훌륭합니다! ${viralRate.toFixed(1)}%의 쇼츠가 바이럴되고 있습니다. 성공 패턴을 분석하여 반복하세요.`
    );
  }

  // 참여율 분석
  if (avgEngagement < 0.01) {
    recommendations.push(
      '평균 참여율이 1% 미만입니다. CTA(Call-to-Action)를 강화하고 댓글 유도 질문을 추가하세요.'
    );
  } else if (avgEngagement > 0.05) {
    recommendations.push(
      `참여율이 ${(avgEngagement * 100).toFixed(2)}%로 우수합니다! 시청자와의 소통을 계속 유지하세요.`
    );
  }

  // 부진한 쇼츠 비율
  const poorRate = (poorCount / shorts.length) * 100;
  if (poorRate > 30) {
    recommendations.push(
      `${poorRate.toFixed(1)}%의 쇼츠 성과가 부진합니다. 썸네일, 제목, 첫 3초를 개선해보세요.`
    );
  }

  // 업로드 빈도 분석
  if (shorts.length < 10) {
    recommendations.push(
      '쇼츠 수가 적습니다. 주 3-5회 꾸준한 업로드로 알고리즘 노출을 늘리세요.'
    );
  }

  // 성공 쇼츠 패턴 분석
  const topShorts = shorts
    .filter(s => s.performance === ShortsPerformance.VIRAL || s.performance === ShortsPerformance.EXCELLENT)
    .slice(0, 5);

  if (topShorts.length > 0) {
    const avgTopDuration = topShorts.reduce((sum, s) => sum + s.duration, 0) / topShorts.length;
    recommendations.push(
      `성공한 쇼츠의 평균 길이는 ${avgTopDuration.toFixed(0)}초입니다. 이 길이를 참고하세요.`
    );
  }

  // 기본 추천사항
  if (recommendations.length === 0) {
    recommendations.push('쇼츠 성과가 안정적입니다. 다양한 포맷과 주제를 실험해보세요.');
  }

  return {
    totalShorts: shorts.length,
    avgViews: Math.round(avgViews),
    avgEngagement,
    viralCount,
    poorCount,
    bestPerformer,
    worstPerformer,
    recommendations,
  };
};

// 소재 발굴: 키워드로 영상 검색 + 채널 정보 포함
export const searchVideosWithChannelInfo = async (
  apiKey: string,
  keyword: string,
  lang: string,
  maxResults: number = 50
): Promise<any[]> => {
  const url = `${API_BASE_URL}/search?part=snippet&q=${encodeURIComponent(keyword)}&order=viewCount&maxResults=${maxResults}&type=video&relevanceLanguage=${lang}&key=${apiKey}`;
  const response = await fetch(url);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error.message || API_ERROR_MESSAGES.YOUTUBE_FETCH_FAILED);
  }
  const data = await response.json();
  return data.items;
};

// 영상 댓글 수집 (최대 100개)
export const getVideoComments = async (
  apiKey: string,
  videoId: string,
  maxResults: number = 100
): Promise<any[]> => {
  try {
    const url = `${API_BASE_URL}/commentThreads?part=snippet&videoId=${videoId}&maxResults=${maxResults}&order=relevance&key=${apiKey}`;
    const response = await fetch(url);

    if (!response.ok) {
      const errorData = await response.json();
      // 댓글이 비활성화된 경우 빈 배열 반환
      if (errorData.error?.errors?.[0]?.reason === 'commentsDisabled') {
        return [];
      }
      throw new Error(errorData.error.message || '댓글을 가져오는데 실패했습니다.');
    }

    const data = await response.json();
    return data.items || [];
  } catch (error: any) {
    console.error('Error fetching comments:', error);
    // 댓글 수집 실패 시 빈 배열 반환 (앱이 중단되지 않도록)
    return [];
  }
};

// 구독자 대비 조회수 비율 계산
export const calculateSubscriberViewRatio = (
  viewCount: number,
  subscriberCount: number
): number => {
  if (subscriberCount === 0) return 0;
  return viewCount / subscriberCount;
};
