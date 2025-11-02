import React, { useState, useCallback } from 'react';
import useLocalStorage from './hooks/useLocalStorage';
import ApiKeyModal from './components/ApiKeyModal';
import AnalysisChart from './components/AnalysisChart';
import { AnalysisResult, AnalysisType, RegionFilter, VideoData, VideoTypeFilter, ChannelAnalysisView } from './types';
import * as youtubeService from './services/youtubeService';
import { generateStrategy } from './services/geminiService';
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
    const [apiKey, setApiKey] = useLocalStorage<string>('youtube-api-key', '');
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

    const handleSearch = useCallback(async () => {
        if (!apiKey) {
            setError('YouTube API 키를 먼저 설정해주세요.');
            setIsModalOpen(true);
            return;
        }
        if (!query) {
            setError(analysisType === AnalysisType.CHANNEL ? '채널명을 입력해주세요.' : '키워드를 입력해주세요.');
            return;
        }

        setIsLoading(true);
        setError(null);
        setAnalysisResult(null);
        setAiStrategy('');

        try {
            const lang = regionFilter === RegionFilter.KOREA ? 'ko' : 'en';
            let videoItems;
            let channelInfo = null;
            let displayVideos: VideoData[] = [];

            if (analysisType === AnalysisType.CHANNEL) {
                channelInfo = await youtubeService.searchChannel(apiKey, query);
                if (!channelInfo) throw new Error('채널을 찾을 수 없습니다.');
                videoItems = await youtubeService.getChannelVideos(apiKey, channelInfo.id, lang);
                
                const videoIds = videoItems.map((item: any) => item.id.videoId).filter(id => id);
                let videoDetails = await youtubeService.getVideoDetails(apiKey, videoIds);
                 // Apply video type filter first
                if(videoTypeFilter === VideoTypeFilter.SHORTS) {
                    videoDetails = videoDetails.filter(v => v.duration > 0 && v.duration < 180);
                } else if (videoTypeFilter === VideoTypeFilter.LONG) {
                    videoDetails = videoDetails.filter(v => v.duration >= 180);
                }

                if (videoDetails.length > 0) {
                    const sortedVideos = [...videoDetails].sort((a, b) => a.popularityScore - b.popularityScore);
                    if (channelView === ChannelAnalysisView.TOP) {
                        displayVideos = sortedVideos.slice(-10).reverse();
                    } else { // BOTTOM
                        displayVideos = sortedVideos.slice(0, 10);
                    }
                }

            } else { // KEYWORD analysis
                videoItems = await youtubeService.searchKeywordVideos(apiKey, query, lang);
                const videoIds = videoItems.map((item: any) => item.id.videoId).filter(id => id);
                let videoDetails = await youtubeService.getVideoDetails(apiKey, videoIds);
                
                // Apply video type filter
                if(videoTypeFilter === VideoTypeFilter.SHORTS) {
                    videoDetails = videoDetails.filter(v => v.duration > 0 && v.duration < 180);
                } else if (videoTypeFilter === VideoTypeFilter.LONG) {
                    videoDetails = videoDetails.filter(v => v.duration >= 180);
                }
                displayVideos = videoDetails.slice(0, 10); // Show top 10 for keyword search for now
            }
            
            const result: AnalysisResult = { channelInfo, videos: displayVideos };
            setAnalysisResult(result);

            if (displayVideos.length > 0) {
              const strategy = await generateStrategy(result, query, analysisType, channelView);
              setAiStrategy(strategy);
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

    const renderResultList = (videos: VideoData[]) => (
        <div className="mt-6 space-y-4">
            {videos.map((video, index) => (
                <div key={video.id} className="flex items-center bg-gray-800 p-3 rounded-lg border border-gray-700">
                    <span className="text-lg font-bold text-gray-400 mr-4 w-8 text-center">{index + 1}</span>
                    <img src={video.thumbnail} alt={video.title} className="w-24 h-14 object-cover rounded mr-4"/>
                    <div className="flex-1">
                        <a href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-white hover:text-blue-400 line-clamp-2">{video.title}</a>
                        <div className="flex items-center text-xs text-gray-400 mt-1 space-x-4">
                            <span>조회수: {video.viewCount.toLocaleString()}</span>
                            <span>좋아요: {video.likeCount.toLocaleString()}</span>
                            <span>댓글: {video.commentCount.toLocaleString()}</span>
                            <span className="font-bold text-purple-400">인기도: {video.popularityScore}</span>
                        </div>
                    </div>
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
                    <div className="flex border-b border-gray-600 mb-4">
                        {(Object.keys(AnalysisType) as Array<keyof typeof AnalysisType>).map(key => (
                            <button
                                key={key}
                                onClick={() => {
                                    setAnalysisType(AnalysisType[key]);
                                    setQuery('');
                                    setAnalysisResult(null);
                                    setError(null);
                                    setAiStrategy('');
                                    setChannelView(ChannelAnalysisView.TOP); // Reset to TOP view
                                }}
                                className={`px-4 py-2 text-lg font-semibold transition-colors ${analysisType === AnalysisType[key] ? 'border-b-2 border-blue-500 text-white' : 'text-gray-400 hover:text-white'}`}
                            >
                                {AnalysisType[key] === 'CHANNEL' ? '채널 분석' : '키워드 분석'}
                            </button>
                        ))}
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


                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Search Input */}
                        <div className="md:col-span-2">
                             <label className="block text-sm font-medium text-gray-300 mb-1">
                                {analysisType === AnalysisType.CHANNEL ? '채널명' : '키워드'}
                             </label>
                            <div className="flex">
                                <input
                                    type="text"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder={analysisType === AnalysisType.CHANNEL ? '분석할 채널명을 입력하세요 (예: 침착맨)' : '분석할 키워드를 입력하세요 (예: 캠핑 브이로그)'}
                                    className="w-full p-3 bg-gray-700 rounded-l-md border-t border-b border-l border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                />
                                <button
                                    onClick={handleSearch}
                                    disabled={isLoading}
                                    className="px-6 py-3 bg-blue-600 rounded-r-md hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-wait font-bold transition-colors"
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
                </div>

                {error && <div className="mt-6 p-4 bg-red-900/50 border border-red-700 text-red-300 rounded-lg">{error}</div>}

                {/* Results Section */}
                {isLoading && <div className="text-center py-20 text-xl">데이터를 분석하고 있습니다...</div>}
                
                {analysisResult && (
                    <div className="mt-8">
                        <div className="flex items-center justify-between mb-4">
                            {analysisResult.channelInfo ? (
                                <div className="flex items-center">
                                    <img src={analysisResult.channelInfo.thumbnail} alt={analysisResult.channelInfo.title} className="w-16 h-16 rounded-full mr-4 border-2 border-gray-600"/>
                                    <h2 className="text-3xl font-bold">{analysisResult.channelInfo.title}</h2>
                                </div>
                            ) : <div/>}
                            {analysisResult.videos.length > 0 && analysisType === AnalysisType.CHANNEL && (
                                <div className="text-right">
                                    <h3 className="text-xl font-bold">{channelView === ChannelAnalysisView.TOP ? '인기 급상승 영상 TOP 10' : '개선 필요 영상 10'}</h3>
                                    <p className="text-sm text-gray-400">최근 업로드 50개 영상 기준</p>
                                </div>
                            )}
                        </div>

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
                                className={`px-4 py-2 rounded-md transition-all text-sm font-semibold flex items-center ${
                                    isCopied 
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
