import React, { useState, useCallback } from 'react';
import useLocalStorage from './hooks/useLocalStorage';
import ApiKeyModal from './components/ApiKeyModal';
import AnalysisChart from './components/AnalysisChart';
import ShortsManagement from './components/ShortsManagement';
import ContentDiscovery from './components/ContentDiscovery';
import {
    AnalysisResult,
    AnalysisType,
    RegionFilter,
    VideoData,
    VideoTypeFilter,
    ChannelAnalysisView,
    ShortsData,
    ShortsAnalysisResult,
    ShortsSummary,
    ContentDiscoveryVideo,
    VideoComment,
    ContentIdea,
    ScriptOutline
} from './types';
import * as youtubeService from './services/youtubeService';
import { generateStrategy, generateVideoSummary, generateShortsAdvice, analyzeCommentsForIdeas, generateScriptOutline } from './services/geminiService';
import { filterByVideoType } from './utils';
import { VIDEO_DURATION_LIMITS, CSV_CONFIG } from './constants';
// Using react-markdown for better display of AI strategy
import ReactMarkdown from 'react-markdown';

// Icons
const YouTubeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);
const SparklesIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1.158a3.001 3.001 0 01-2 .924V6a1 1 0 11-2 0V4.082A3.001 3.001 0 010 3V2a1 1 0 011-1h4zm12 0a1 1 0 011 1v1.082A3.001 3.001 0 0115 6V4.082A3.001 3.001 0 0113.842 3H13a1 1 0 01-1-1V1a1 1 0 011-1h4zM2 10.158V14a1 1 0 102 0v-3.918a3.001 3.001 0 012-.924V8a1 1 0 102 0v1.082A3.001 3.001 0 0110 12v3.918a3.001 3.001 0 012 .924V18a1 1 0 102 0v-1.082a3.001 3.001 0 01-2-2.918V12a1 1 0 10-2 0v1.082A3.001 3.001 0 018 16v-3.918a3.001 3.001 0 01-2-.924V10a1 1 0 10-2 0v.158z" clipRule="evenodd" />
    </svg>
);
const CopyIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
);


const App: React.FC = () => {
    // YouTube API 키: 환경변수 우선, 없으면 로컬스토리지 사용 (하위 호환성)
    const envYoutubeApiKey = (import.meta.env?.YOUTUBE_API_KEY as string) ||
        (import.meta.env?.VITE_YOUTUBE_API_KEY as string) ||
        '';
    const [storedApiKey, setStoredApiKey] = useLocalStorage<string>('youtube-api-key', '');
    const apiKey = envYoutubeApiKey || storedApiKey;
    const setApiKey = (key: string) => {
        // 환경변수가 설정되어 있으면 로컬스토리지에 저장하지 않음
        if (!envYoutubeApiKey) {
            setStoredApiKey(key);
        }
    };

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [analysisType, setAnalysisType] = useState<AnalysisType>(AnalysisType.CHANNEL);
    const [channelView, setChannelView] = useState<ChannelAnalysisView>(ChannelAnalysisView.TOP);
    const [query, setQuery] = useState('');

    const [regionFilter, setRegionFilter] = useState<RegionFilter>(RegionFilter.KOREA);
    const [videoTypeFilter, setVideoTypeFilter] = useState<VideoTypeFilter>(VideoTypeFilter.ALL);

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
    const [aiStrategy, setAiStrategy] = useState<string>('');
    const [isCopied, setIsCopied] = useState(false);
    const [selectedVideoForSummary, setSelectedVideoForSummary] = useState<VideoData | null>(null);
    const [videoSummary, setVideoSummary] = useState<string>('');
    const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

    // 쇼츠 관리 관련 state
    const [shortsAnalysis, setShortsAnalysis] = useState<ShortsAnalysisResult | null>(null);
    const [shortsAiAdvice, setShortsAiAdvice] = useState<{ [videoId: string]: string }>({});

    // 소재 발굴 관련 state
    const [contentDiscoveryVideos, setContentDiscoveryVideos] = useState<ContentDiscoveryVideo[]>([]);
    const [selectedDiscoveryVideo, setSelectedDiscoveryVideo] = useState<ContentDiscoveryVideo | null>(null);
    const [videoComments, setVideoComments] = useState<VideoComment[]>([]);
    const [contentIdeas, setContentIdeas] = useState<ContentIdea[]>([]);
    const [scriptOutline, setScriptOutline] = useState<ScriptOutline | null>(null);
    const [isGeneratingIdeas, setIsGeneratingIdeas] = useState(false);
    const [isGeneratingOutline, setIsGeneratingOutline] = useState(false);

    const handleSearch = useCallback(async () => {
        if (!apiKey) {
            const errorMsg = envYoutubeApiKey
                ? 'YouTube API 키가 환경변수에 설정되지 않았습니다. .env.local 파일을 확인하세요.'
                : 'YouTube API 키를 먼저 설정해주세요.';
            setError(errorMsg);
            if (!envYoutubeApiKey) {
                setIsModalOpen(true);
            }
            return;
        }
        if (!query) {
            const errorMsg =
                analysisType === AnalysisType.CHANNEL ? '채널명 또는 URL을 입력해주세요.' :
                    analysisType === AnalysisType.SHORTS_MANAGEMENT ? '채널명 또는 URL을 입력해주세요.' :
                        analysisType === AnalysisType.RISING_STAR ? '키워드를 입력해주세요.' :
                            analysisType === AnalysisType.BLUE_OCEAN ? '키워드/해시태그를 입력해주세요.' :
                                '키워드를 입력해주세요.';
            setError(errorMsg);
            return;
        }

        setIsLoading(true);
        setError(null);
        setAnalysisResult(null);
        setAiStrategy('');
        setShortsAnalysis(null);
        setShortsAiAdvice({});

        try {
            const lang = regionFilter === RegionFilter.KOREA ? 'ko' : 'en';
            let videoItems;
            let channelInfo = null;
            let displayVideos: VideoData[] = [];

            if (analysisType === AnalysisType.CHANNEL) {
                channelInfo = await youtubeService.searchChannel(apiKey, query);
                if (!channelInfo) throw new Error('채널을 찾을 수 없습니다.');
                videoItems = await youtubeService.getChannelVideos(apiKey, channelInfo.id, lang);

                const videoIds = videoItems.map((item: any) => item.id.videoId).filter((id: string) => id);
                let videoDetails = await youtubeService.getVideoDetails(apiKey, videoIds);
                // Apply video type filter using utils
                videoDetails = filterByVideoType(videoDetails, videoTypeFilter, VIDEO_DURATION_LIMITS.SHORTS_EXTENDED_MAX_SECONDS);

                if (videoDetails.length > 0) {
                    const sortedVideos = [...videoDetails].sort((a, b) => a.popularityScore - b.popularityScore);
                    if (channelView === ChannelAnalysisView.TOP) {
                        displayVideos = sortedVideos.slice(-10).reverse();
                    } else { // BOTTOM
                        displayVideos = sortedVideos.slice(0, 10);
                    }
                }

            } else if (analysisType === AnalysisType.KEYWORD) { // KEYWORD analysis
                videoItems = await youtubeService.searchKeywordVideos(apiKey, query, lang);
                const videoIds = videoItems.map((item: any) => item.id.videoId).filter((id: string) => id);
                let videoDetails = await youtubeService.getVideoDetails(apiKey, videoIds);

                // Apply video type filter using utils
                videoDetails = filterByVideoType(videoDetails, videoTypeFilter, VIDEO_DURATION_LIMITS.SHORTS_EXTENDED_MAX_SECONDS);
                displayVideos = videoDetails.slice(0, 10); // Show top 10 for keyword search for now
            } else if (analysisType === AnalysisType.RISING_STAR) { // 라이징 스타 찾기
                const risingChannels = await youtubeService.findRisingStarChannels(apiKey, query, lang);
                if (risingChannels.length > 0) {
                    // 첫 번째 채널을 분석 대상으로 설정
                    const firstChannel = risingChannels[0];
                    channelInfo = firstChannel;
                    videoItems = await youtubeService.getChannelVideos(apiKey, firstChannel.id, lang);
                    const videoIds = videoItems.map((item: any) => item.id.videoId).filter(id => id);
                    let videoDetails = await youtubeService.getVideoDetails(apiKey, videoIds);
                    displayVideos = videoDetails.slice(0, 10);
                } else {
                    throw new Error('라이징 스타 채널을 찾을 수 없습니다. 다른 키워드로 시도해보세요.');
                }
            } else if (analysisType === AnalysisType.BLUE_OCEAN) { // 빈집 토픽 분석
                // 키워드로 검색 후 빈집 토픽 분석 수행
                videoItems = await youtubeService.searchKeywordVideos(apiKey, query, lang);
                const videoIds = videoItems.map((item: any) => item.id.videoId).filter(id => id);
                let videoDetails = await youtubeService.getVideoDetails(apiKey, videoIds);

                displayVideos = videoDetails.slice(0, 50); // 빈집 토픽 분석은 더 많은 데이터 필요
            } else if (analysisType === AnalysisType.SHORTS_MANAGEMENT) { // 쇼츠 관리
                channelInfo = await youtubeService.searchChannel(apiKey, query);
                if (!channelInfo) throw new Error('채널을 찾을 수 없습니다.');

                videoItems = await youtubeService.getChannelVideos(apiKey, channelInfo.id, lang);
                const videoIds = videoItems.map((item: any) => item.id.videoId).filter(id => id);
                const videoDetails = await youtubeService.getVideoDetails(apiKey, videoIds);

                // 쇼츠 성능 분석
                const shortsData = youtubeService.analyzeShortsPerformance(
                    videoDetails,
                    channelInfo.subscriberCount
                );

                if (shortsData.length === 0) {
                    throw new Error('이 채널에는 쇼츠 영상이 없습니다. (60초 이하 영상)');
                }

                const summary = youtubeService.generateShortsSummary(shortsData);

                setShortsAnalysis({
                    channelInfo,
                    videos: shortsData,
                    summary,
                });

                // 쇼츠 관리는 별도 처리하므로 일반 분석 결과는 설정하지 않음
                setAnalysisResult(null);
                setIsLoading(false);
                return;
            }

            const result: AnalysisResult = { channelInfo, videos: displayVideos };
            setAnalysisResult(result);

            if (displayVideos.length > 0) {
                try {
                    const strategy = await generateStrategy(result, query, analysisType, channelView);
                    setAiStrategy(strategy);
                } catch (strategyError: any) {
                    // AI 전략 생성 실패 시 에러 메시지를 전략으로 표시하여 사용자에게 알림
                    setAiStrategy(`⚠️ ${strategyError?.message || "AI 전략 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요."}`);
                    console.error("AI strategy generation failed:", strategyError);
                }
            } else {
                setAiStrategy("분석할 영상이 충분하지 않아 전략을 생성할 수 없습니다.");
            }

        } catch (e: any) {
            setError(e.message || '분석 중 오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
        }
    }, [apiKey, query, analysisType, regionFilter, videoTypeFilter, channelView]);

    const handleCopyStrategy = useCallback(() => {
        if (!aiStrategy) return;
        navigator.clipboard.writeText(aiStrategy).then(() => {
            setIsCopied(true);
            setTimeout(() => {
                setIsCopied(false);
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy strategy: ', err);
            alert('전략 복사에 실패했습니다.');
        });
    }, [aiStrategy]);

    const handleVideoSummary = useCallback(async (video: VideoData) => {
        setSelectedVideoForSummary(video);
        setIsGeneratingSummary(true);
        setVideoSummary('');
        try {
            const summary = await generateVideoSummary(video, analysisResult?.channelInfo?.title);
            setVideoSummary(summary);
        } catch (error: any) {
            setVideoSummary(`⚠️ 요약 생성 중 오류가 발생했습니다: ${error.message}`);
        } finally {
            setIsGeneratingSummary(false);
        }
    }, [analysisResult?.channelInfo?.title]);

    const handleDownloadCSV = useCallback(() => {
        if (!analysisResult || analysisResult.videos.length === 0) return;

        const headers = ['제목', '조회수', '좋아요', '댓글', '영상길이(초)', '인기도점수', '업로드일', '링크'];
        const rows = analysisResult.videos.map(v => [
            `"${v.title.replace(/"/g, '""')}"`,
            v.viewCount,
            v.likeCount,
            v.commentCount,
            v.duration,
            v.popularityScore,
            v.publishedAt || '',
            `https://www.youtube.com/watch?v=${v.id}`
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');

        const blob = new Blob([CSV_CONFIG.BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${CSV_CONFIG.FILENAME_PREFIX}_${analysisResult.channelInfo?.title || 'analysis'}_${new Date().toISOString().split('T')[0]}${CSV_CONFIG.FILE_EXTENSION}`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, [analysisResult]);

    // 쇼츠 AI 개선 제안 핸들러
    const handleGenerateShortsAdvice = useCallback(async (videoId: string) => {
        if (!shortsAnalysis) return;

        const short = shortsAnalysis.videos.find(s => s.id === videoId);
        if (!short) return;

        // 이미 생성 중이거나 생성된 경우 스킵
        if (shortsAiAdvice[videoId]) return;

        // 로딩 상태 표시
        setShortsAiAdvice(prev => ({ ...prev, [videoId]: '생성 중...' }));

        try {
            const advice = await generateShortsAdvice(short, shortsAnalysis.channelInfo);
            setShortsAiAdvice(prev => ({ ...prev, [videoId]: advice }));
        } catch (error: any) {
            setShortsAiAdvice(prev => ({
                ...prev,
                [videoId]: `⚠️ 개선 제안 생성 중 오류가 발생했습니다: ${error.message}`
            }));
        }
    }, [shortsAnalysis, shortsAiAdvice]);

    // 소재 발굴: 키워드 검색 핸들러
    const handleContentDiscoverySearch = useCallback(async (keyword: string, minRatio: number) => {
        if (!apiKey) {
            setError('YouTube API 키를 먼저 설정해주세요.');
            return;
        }

        setIsLoading(true);
        setError(null);
        setContentDiscoveryVideos([]);
        setVideoComments([]);
        setContentIdeas([]);
        setScriptOutline(null);
        setSelectedDiscoveryVideo(null);

        try {
            const lang = regionFilter === RegionFilter.KOREA ? 'ko' : 'en';
            const videoItems = await youtubeService.searchVideosWithChannelInfo(apiKey, keyword, lang, 50);

            const videoIds = videoItems.map((item: any) => item.id.videoId).filter((id: string) => id);
            const videoDetails = await youtubeService.getVideoDetails(apiKey, videoIds);

            // 각 영상의 채널 구독자 수 가져오기
            const channelIds = [...new Set(videoDetails.map(v => v.channelId).filter(Boolean))];
            const channelInfoMap = new Map<string, number>();

            // 채널 정보 배치 처리
            const batches = [];
            for (let i = 0; i < channelIds.length; i += 50) {
                batches.push(channelIds.slice(i, i + 50));
            }

            for (const batch of batches) {
                const channelsUrl = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${batch.join(',')}&key=${apiKey}`;
                const response = await fetch(channelsUrl);
                if (response.ok) {
                    const data = await response.json();
                    data.items?.forEach((ch: any) => {
                        channelInfoMap.set(ch.id, parseInt(ch.statistics?.subscriberCount || '0', 10));
                    });
                }
            }

            // ContentDiscoveryVideo 생성 및 필터링
            const discoveryVideos: ContentDiscoveryVideo[] = videoDetails
                .map(video => {
                    const subscriberCount = channelInfoMap.get(video.channelId || '') || 0;
                    const ratio = youtubeService.calculateSubscriberViewRatio(video.viewCount, subscriberCount);
                    return {
                        ...video,
                        channelSubscriberCount: subscriberCount,
                        subscriberViewRatio: ratio,
                    };
                })
                .filter(v => v.subscriberViewRatio >= minRatio)
                .sort((a, b) => b.subscriberViewRatio - a.subscriberViewRatio);

            setContentDiscoveryVideos(discoveryVideos);

            if (discoveryVideos.length === 0) {
                setError(`구독자 대비 조회수 비율이 ${minRatio}배 이상인 영상을 찾을 수 없습니다. 필터 값을 낮춰보세요.`);
            }
        } catch (e: any) {
            setError(e.message || '소재 발굴 검색 중 오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
        }
    }, [apiKey, regionFilter]);

    // 소재 발굴: 댓글 수집 핸들러
    const handleCollectComments = useCallback(async (videoId: string) => {
        if (!apiKey) return;

        setIsLoading(true);
        setError(null);
        setVideoComments([]);
        setContentIdeas([]);
        setScriptOutline(null);

        try {
            const selectedVideo = contentDiscoveryVideos.find(v => v.id === videoId);
            setSelectedDiscoveryVideo(selectedVideo || null);

            const rawComments = await youtubeService.getVideoComments(apiKey, videoId, 100);

            const comments: VideoComment[] = rawComments.map((item: any) => ({
                id: item.id,
                author: item.snippet.topLevelComment.snippet.authorDisplayName,
                text: item.snippet.topLevelComment.snippet.textDisplay,
                likeCount: item.snippet.topLevelComment.snippet.likeCount || 0,
                publishedAt: item.snippet.topLevelComment.snippet.publishedAt,
            }));

            setVideoComments(comments);

            if (comments.length === 0) {
                setError('이 영상은 댓글이 비활성화되어 있거나 댓글이 없습니다.');
            }
        } catch (e: any) {
            setError(e.message || '댓글 수집 중 오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
        }
    }, [apiKey, contentDiscoveryVideos]);

    // 소재 발굴: AI 아이디어 생성 핸들러
    const handleGenerateIdeas = useCallback(async () => {
        if (videoComments.length === 0 || !selectedDiscoveryVideo) return;

        setIsGeneratingIdeas(true);
        setContentIdeas([]);
        setScriptOutline(null);

        try {
            const rawComments = videoComments.map(c => ({
                snippet: {
                    topLevelComment: {
                        snippet: {
                            textDisplay: c.text,
                        },
                    },
                },
            }));

            const response = await analyzeCommentsForIdeas(
                rawComments,
                selectedDiscoveryVideo.title,
                selectedDiscoveryVideo.description
            );

            // JSON 파싱 (마크다운 코드 블록 제거)
            let jsonText = response.trim();
            if (jsonText.startsWith('```')) {
                jsonText = jsonText.replace(/^```(?:json)?\n/, '').replace(/\n```$/, '');
            }

            const ideas: ContentIdea[] = JSON.parse(jsonText);
            setContentIdeas(ideas);
        } catch (e: any) {
            setError(`AI 아이디어 생성 중 오류: ${e.message}`);
        } finally {
            setIsGeneratingIdeas(false);
        }
    }, [videoComments, selectedDiscoveryVideo]);

    // 소재 발굴: 대본 목차 생성 핸들러
    const handleGenerateOutline = useCallback(async (idea: ContentIdea) => {
        setIsGeneratingOutline(true);
        setScriptOutline(null);

        try {
            const response = await generateScriptOutline(
                idea,
                selectedDiscoveryVideo?.title
            );

            // JSON 파싱 (마크다운 코드 블록 제거)
            let jsonText = response.trim();
            if (jsonText.startsWith('```')) {
                jsonText = jsonText.replace(/^```(?:json)?\n/, '').replace(/\n```$/, '');
            }

            const outline: ScriptOutline = JSON.parse(jsonText);
            setScriptOutline(outline);
        } catch (e: any) {
            setError(`대본 목차 생성 중 오류: ${e.message}`);
        } finally {
            setIsGeneratingOutline(false);
        }
    }, [selectedDiscoveryVideo]);

    const renderResultList = (videos: VideoData[]) => (
        <div className="mt-6 space-y-4">
            {videos.map((video, index) => (
                <div key={video.id} className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                    <div className="flex items-start">
                        <span className="text-lg font-bold text-gray-400 mr-4 w-8 text-center flex-shrink-0">{index + 1}</span>
                        <img src={video.thumbnail} alt={video.title} className="w-32 h-20 object-cover rounded mr-4 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                            <a href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-white hover:text-blue-400 line-clamp-2 block">{video.title}</a>
                            <div className="flex items-center text-xs text-gray-400 mt-2 space-x-4 flex-wrap gap-2">
                                <span>조회수: {video.viewCount.toLocaleString()}</span>
                                <span>좋아요: {video.likeCount.toLocaleString()}</span>
                                <span>댓글: {video.commentCount.toLocaleString()}</span>
                                <span>길이: {Math.floor(video.duration / 60)}:{String(video.duration % 60).padStart(2, '0')}</span>
                                <span className="font-bold text-purple-400 group relative">
                                    인기도: {video.popularityScore}
                                    <span className="absolute left-full ml-2 top-0 w-48 p-2 bg-gray-900 border border-gray-600 rounded text-xs text-gray-300 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 pointer-events-none">
                                        조회수 대비 참여율
                                        <br />
                                        <span className="text-purple-300 text-xs">(좋아요×0.6 + 댓글×0.4) ÷ 조회수 × 1000</span>
                                    </span>
                                </span>
                            </div>
                            <button
                                onClick={() => handleVideoSummary(video)}
                                disabled={isGeneratingSummary && selectedVideoForSummary?.id === video.id}
                                className="mt-2 px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:cursor-wait rounded transition-colors flex items-center"
                            >
                                <SparklesIcon />
                                {isGeneratingSummary && selectedVideoForSummary?.id === video.id ? '요약 생성 중...' : 'AI 요약'}
                            </button>
                        </div>
                    </div>
                    {selectedVideoForSummary?.id === video.id && videoSummary && (
                        <div className="mt-4 p-4 bg-gray-900 rounded border border-gray-600">
                            <div className="prose prose-invert max-w-none prose-sm">
                                <ReactMarkdown>{videoSummary}</ReactMarkdown>
                            </div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    )

    return (
        <div className="min-h-screen bg-gray-900 text-white font-sans">
            <ApiKeyModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={setApiKey}
                currentApiKey={apiKey}
                isEnvKeySet={!!envYoutubeApiKey}
            />

            <header className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700 p-4 flex justify-between items-center sticky top-0 z-10">
                <div className="flex items-center">
                    <YouTubeIcon />
                    <h1 className="text-2xl font-bold">AI 유튜브 전략 컨설턴트</h1>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="px-4 py-2 bg-blue-600 rounded-md hover:bg-blue-700 transition-colors text-sm font-semibold"
                >
                    API 키 설정
                </button>
            </header>

            <main className="p-4 md:p-8 max-w-7xl mx-auto">
                {/* Search and Filter Section */}
                <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
                    <div className="flex border-b border-gray-600 mb-4 overflow-x-auto">
                        <button
                            onClick={() => {
                                setAnalysisType(AnalysisType.CHANNEL);
                                setQuery('');
                                setAnalysisResult(null);
                                setError(null);
                                setAiStrategy('');
                                setChannelView(ChannelAnalysisView.TOP);
                                setShortsAnalysis(null);
                            }}
                            className={`px-4 py-2 text-lg font-semibold transition-colors whitespace-nowrap ${analysisType === AnalysisType.CHANNEL ? 'border-b-2 border-blue-500 text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                            채널 분석
                        </button>
                        <button
                            onClick={() => {
                                setAnalysisType(AnalysisType.KEYWORD);
                                setQuery('');
                                setAnalysisResult(null);
                                setError(null);
                                setAiStrategy('');
                                setShortsAnalysis(null);
                            }}
                            className={`px-4 py-2 text-lg font-semibold transition-colors whitespace-nowrap ${analysisType === AnalysisType.KEYWORD ? 'border-b-2 border-blue-500 text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                            키워드 분석
                        </button>
                        <button
                            onClick={() => {
                                setAnalysisType(AnalysisType.RISING_STAR);
                                setQuery('');
                                setAnalysisResult(null);
                                setError(null);
                                setAiStrategy('');
                                setShortsAnalysis(null);
                            }}
                            className={`px-4 py-2 text-lg font-semibold transition-colors whitespace-nowrap ${analysisType === AnalysisType.RISING_STAR ? 'border-b-2 border-blue-500 text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                            라이징 스타 찾기
                        </button>
                        <button
                            onClick={() => {
                                setAnalysisType(AnalysisType.BLUE_OCEAN);
                                setQuery('');
                                setAnalysisResult(null);
                                setError(null);
                                setAiStrategy('');
                                setShortsAnalysis(null);
                            }}
                            className={`px-4 py-2 text-lg font-semibold transition-colors whitespace-nowrap ${analysisType === AnalysisType.BLUE_OCEAN ? 'border-b-2 border-blue-500 text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                            빈집 토픽 분석
                        </button>
                        <button
                            onClick={() => {
                                setAnalysisType(AnalysisType.SHORTS_MANAGEMENT);
                                setQuery('');
                                setAnalysisResult(null);
                                setError(null);
                                setAiStrategy('');
                                setShortsAnalysis(null);
                            }}
                            className={`px-4 py-2 text-lg font-semibold transition-colors whitespace-nowrap ${analysisType === AnalysisType.SHORTS_MANAGEMENT ? 'border-b-2 border-blue-500 text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                            쇼츠 관리
                        </button>
                        <button
                            onClick={() => {
                                setAnalysisType(AnalysisType.CONTENT_DISCOVERY);
                                setQuery('');
                                setAnalysisResult(null);
                                setError(null);
                                setAiStrategy('');
                                setShortsAnalysis(null);
                                setContentDiscoveryVideos([]);
                                setVideoComments([]);
                                setContentIdeas([]);
                                setScriptOutline(null);
                            }}
                            className={`px-4 py-2 text-lg font-semibold transition-colors whitespace-nowrap ${analysisType === AnalysisType.CONTENT_DISCOVERY ? 'border-b-2 border-blue-500 text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                            소재 발굴
                        </button>
                    </div>

                    {analysisType === AnalysisType.CHANNEL && (
                        <div className="mb-4 flex items-center gap-2 rounded-lg bg-gray-700/50 p-1 w-fit">
                            <button onClick={() => setChannelView(ChannelAnalysisView.TOP)} className={`px-4 py-2 text-sm rounded-md transition-colors ${channelView === ChannelAnalysisView.TOP ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-600'}`}>
                                인기도 TOP 10
                            </button>
                            <button onClick={() => setChannelView(ChannelAnalysisView.BOTTOM)} className={`px-4 py-2 text-sm rounded-md transition-colors ${channelView === ChannelAnalysisView.BOTTOM ? 'bg-red-600 text-white' : 'text-gray-300 hover:bg-gray-600'}`}>
                                인기도 최하위 10
                            </button>
                        </div>
                    )}


                    {/* 소재 발굴 탭에서는 검색 섹션 숨김 (ContentDiscovery 컴포넌트가 자체 검색 UI 제공) */}
                    {analysisType !== AnalysisType.CONTENT_DISCOVERY && (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* Search Input */}
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-300 mb-1">
                                        {analysisType === AnalysisType.CHANNEL ? '채널명 또는 URL' :
                                            analysisType === AnalysisType.SHORTS_MANAGEMENT ? '채널명 또는 URL' :
                                                analysisType === AnalysisType.RISING_STAR ? '키워드/주제' :
                                                    analysisType === AnalysisType.BLUE_OCEAN ? '키워드/해시태그' : '키워드'}
                                    </label>
                                    <div className="flex">
                                        <input
                                            type="text"
                                            value={query}
                                            onChange={(e) => setQuery(e.target.value)}
                                            placeholder={
                                                analysisType === AnalysisType.CHANNEL ? '채널명 또는 URL 입력 (예: 침착맨 또는 https://youtube.com/@침착맨)' :
                                                    analysisType === AnalysisType.SHORTS_MANAGEMENT ? '채널명 또는 URL 입력 (예: 침착맨 또는 https://youtube.com/@침착맨)' :
                                                        analysisType === AnalysisType.RISING_STAR ? '최근 급성장 채널을 찾을 키워드를 입력하세요 (예: 브이로그)' :
                                                            analysisType === AnalysisType.BLUE_OCEAN ? '시장 분석할 키워드/해시태그를 입력하세요' :
                                                                '분석할 키워드를 입력하세요 (예: 캠핑 브이로그)'
                                            }
                                            className="w-full p-3 bg-gray-700 rounded-l-md border-t border-b border-l border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                        />
                                        <button
                                            onClick={handleSearch}
                                            disabled={isLoading}
                                            className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 bg-blue-600 rounded-r-md hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-wait font-bold transition-colors text-xs sm:text-sm md:text-base whitespace-nowrap"
                                        >
                                            {isLoading ? '분석중...' : '분석 시작'}
                                        </button>
                                    </div>
                                </div>

                                {/* Filters */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-1">지역</label>
                                        <select value={regionFilter} onChange={(e) => setRegionFilter(e.target.value as RegionFilter)} className="w-full p-3 bg-gray-700 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
                                            <option value={RegionFilter.KOREA}>한국</option>
                                            <option value={RegionFilter.OVERSEAS}>해외</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-1">영상 종류</label>
                                        <select value={videoTypeFilter} onChange={(e) => setVideoTypeFilter(e.target.value as VideoTypeFilter)} className="w-full p-3 bg-gray-700 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
                                            <option value={VideoTypeFilter.ALL}>전체</option>
                                            <option value={VideoTypeFilter.SHORTS}>쇼츠 (3분 미만)</option>
                                            <option value={VideoTypeFilter.LONG}>일반 (3분 이상)</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {error && <div className="mt-6 p-4 bg-red-900/50 border border-red-700 text-red-300 rounded-lg">{error}</div>}

                {/* Results Section */}
                {isLoading && <div className="text-center py-20 text-xl">데이터를 분석하고 있습니다...</div>}

                {/* 쇼츠 관리 결과 */}
                {shortsAnalysis && (
                    <div className="mt-8">
                        <ShortsManagement
                            channelInfo={shortsAnalysis.channelInfo}
                            shorts={shortsAnalysis.videos}
                            summary={shortsAnalysis.summary}
                            isLoading={isLoading}
                            onGenerateAIAdvice={handleGenerateShortsAdvice}
                            aiAdvice={shortsAiAdvice}
                        />
                    </div>
                )}

                {/* 소재 발굴 */}
                {analysisType === AnalysisType.CONTENT_DISCOVERY && (
                    <div className="mt-8">
                        <ContentDiscovery
                            apiKey={apiKey}
                            onSearch={handleContentDiscoverySearch}
                            isLoading={isLoading}
                            videos={contentDiscoveryVideos}
                            onCollectComments={handleCollectComments}
                            comments={videoComments}
                            selectedVideo={selectedDiscoveryVideo}
                            onGenerateIdeas={handleGenerateIdeas}
                            contentIdeas={contentIdeas}
                            isGeneratingIdeas={isGeneratingIdeas}
                            onGenerateOutline={handleGenerateOutline}
                            scriptOutline={scriptOutline}
                            isGeneratingOutline={isGeneratingOutline}
                        />
                    </div>
                )}

                {analysisResult && (
                    <div className="mt-8">
                        <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
                            {analysisResult.channelInfo ? (
                                <div className="flex items-center">
                                    <img src={analysisResult.channelInfo.thumbnail} alt={analysisResult.channelInfo.title} className="w-16 h-16 rounded-full mr-4 border-2 border-gray-600" />
                                    <div>
                                        <h2 className="text-3xl font-bold">{analysisResult.channelInfo.title}</h2>
                                        {(analysisResult.channelInfo.subscriberCount || analysisResult.channelInfo.totalViewCount || analysisResult.channelInfo.videoCount) && (
                                            <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
                                                {analysisResult.channelInfo.subscriberCount !== undefined && (
                                                    <span>구독자: {analysisResult.channelInfo.subscriberCount.toLocaleString()}</span>
                                                )}
                                                {analysisResult.channelInfo.totalViewCount !== undefined && (
                                                    <span>총 조회수: {analysisResult.channelInfo.totalViewCount.toLocaleString()}</span>
                                                )}
                                                {analysisResult.channelInfo.videoCount !== undefined && (
                                                    <span>영상 수: {analysisResult.channelInfo.videoCount.toLocaleString()}</span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : <div />}
                            <div className="flex items-center gap-4">
                                {analysisResult.videos.length > 0 && (
                                    <button
                                        onClick={handleDownloadCSV}
                                        className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-md text-sm font-semibold transition-colors flex items-center"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        CSV 다운로드
                                    </button>
                                )}
                                {analysisResult.videos.length > 0 && analysisType === AnalysisType.CHANNEL && (
                                    <div className="text-right">
                                        <h3 className="text-xl font-bold">{channelView === ChannelAnalysisView.TOP ? '인기 급상승 영상 TOP 10' : '개선 필요 영상 10'}</h3>
                                        <p className="text-sm text-gray-400">최근 업로드 50개 영상 기준</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 통계 대시보드 */}
                        {analysisResult.channelInfo && analysisResult.videos.length > 0 && (
                            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                                    <div className="text-sm text-gray-400">쇼츠 비율</div>
                                    <div className="text-2xl font-bold text-blue-400">
                                        {Math.round((analysisResult.videos.filter(v => v.duration < 180).length / analysisResult.videos.length) * 100)}%
                                    </div>
                                </div>
                                <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                                    <div className="text-sm text-gray-400">평균 조회수</div>
                                    <div className="text-2xl font-bold text-green-400">
                                        {Math.round(analysisResult.videos.reduce((sum, v) => sum + v.viewCount, 0) / analysisResult.videos.length).toLocaleString()}
                                    </div>
                                </div>
                                <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                                    <div className="text-sm text-gray-400">평균 인기도</div>
                                    <div className="text-2xl font-bold text-purple-400">
                                        {(analysisResult.videos.reduce((sum, v) => sum + v.popularityScore, 0) / analysisResult.videos.length).toFixed(2)}
                                    </div>
                                </div>
                                <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                                    <div className="text-sm text-gray-400">평균 영상 길이</div>
                                    <div className="text-2xl font-bold text-yellow-400">
                                        {Math.floor(analysisResult.videos.reduce((sum, v) => sum + v.duration, 0) / analysisResult.videos.length / 60)}분
                                    </div>
                                </div>
                            </div>
                        )}

                        <AnalysisChart data={analysisResult.videos} />
                        {renderResultList(analysisResult.videos)}
                    </div>
                )}

                {aiStrategy && (
                    <div className="mt-8 bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-2xl font-bold flex items-center text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-500">
                                <SparklesIcon /> AI 기반 성장 전략
                            </h2>
                            <button
                                onClick={handleCopyStrategy}
                                className={`px-4 py-2 rounded-md transition-all text-sm font-semibold flex items-center ${isCopied
                                    ? 'bg-green-600 text-white'
                                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                    }`}
                            >
                                <CopyIcon />
                                {isCopied ? '복사 완료!' : '전략 복사'}
                            </button>
                        </div>
                        <div className="prose prose-invert max-w-none prose-h3:text-lg prose-h3:font-semibold prose-a:text-blue-400 hover:prose-a:text-blue-300 prose-strong:text-gray-200">
                            <ReactMarkdown>{aiStrategy}</ReactMarkdown>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default App;
