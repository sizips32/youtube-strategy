import { ChannelInfo, VideoData } from '../types';

const API_BASE_URL = 'https://www.googleapis.com/youtube/v3';

const parseDuration = (duration: string): number => {
    const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    if (!match) return 0;
    const hours = (parseInt(match[1]) || 0);
    const minutes = (parseInt(match[2]) || 0);
    const seconds = (parseInt(match[3]) || 0);
    return hours * 3600 + minutes * 60 + seconds;
};


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

export const searchChannel = async (apiKey: string, channelName: string): Promise<ChannelInfo | null> => {
    const url = `${API_BASE_URL}/search?part=snippet&q=${encodeURIComponent(channelName)}&type=channel&maxResults=1&key=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error.message || 'Failed to search for channel.');
    }
    const data = await response.json();
    if (data.items.length === 0) return null;

    const channel = data.items[0];
    const channelId = channel.id.channelId;
    
    // 채널 통계 정보 가져오기
    const statsUrl = `${API_BASE_URL}/channels?part=snippet,statistics&id=${channelId}&key=${apiKey}`;
    const statsResponse = await fetch(statsUrl);
    if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        if (statsData.items && statsData.items.length > 0) {
            const stats = statsData.items[0];
            return {
                id: channelId,
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
        id: channelId,
        title: channel.snippet.title,
        thumbnail: channel.snippet.thumbnails.default.url,
    };
};

export const getChannelVideos = async (apiKey: string, channelId: string, lang: string): Promise<any[]> => {
    const url = `${API_BASE_URL}/search?part=snippet&channelId=${channelId}&order=date&maxResults=50&type=video&relevanceLanguage=${lang}&key=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error.message || 'Failed to fetch channel videos.');
    }
    const data = await response.json();
    return data.items;
};

export const searchKeywordVideos = async (apiKey: string, keyword: string, lang: string): Promise<any[]> => {
    const url = `${API_BASE_URL}/search?part=snippet&q=${encodeURIComponent(keyword)}&order=relevance&maxResults=50&type=video&relevanceLanguage=${lang}&key=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error.message || 'Failed to search for keyword videos.');
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
        throw new Error(errorData.error.message || 'Failed to fetch video details.');
    }
    const data = await response.json();

    return data.items.map((item: any) => {
        const viewCount = parseInt(item.statistics.viewCount || '0', 10);
        const likeCount = parseInt(item.statistics.likeCount || '0', 10);
        const commentCount = parseInt(item.statistics.commentCount || '0', 10);
        
        // Popularity score calculation (weighted)
        const score = viewCount > 0 ? ((likeCount * 0.6 + commentCount * 0.4) / viewCount) * 1000 : 0;

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
    
    const url = `${API_BASE_URL}/search?part=snippet&q=${encodeURIComponent(keyword)}&order=viewCount&type=video&publishedAfter=${publishedAfterISO}&maxResults=50&relevanceLanguage=${lang}&key=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error.message || 'Failed to find rising star channels.');
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
    
    // 채널 통계 API 호출 (50개씩 배치)
    for (let i = 0; i < channelIds.length; i += 50) {
        const batch = channelIds.slice(i, i + 50);
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
                    
                    // 구독자 수가 적당하고(1000~100000), 영상 수가 적당한 채널 우선 (라이징 스타 특성)
                    if (subscriberCount >= 1000 && subscriberCount < 100000 && videoCount >= 5) {
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
        .slice(0, 10); // 상위 10개만 반환
};
