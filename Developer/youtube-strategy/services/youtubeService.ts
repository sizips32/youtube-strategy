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


export const testApiKey = async (apiKey: string): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE_URL}/search?part=snippet&q=test&key=${apiKey}`);
    return response.ok;
  } catch (error) {
    console.error('API Key test failed:', error);
    return false;
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
    return {
        id: channel.id.channelId,
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
        };
    });
};