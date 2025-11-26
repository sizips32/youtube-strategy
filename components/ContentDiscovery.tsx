import React, { useState } from 'react';
import { ContentDiscoveryVideo, VideoComment, ContentIdea, ScriptOutline } from '../types';
import ReactMarkdown from 'react-markdown';

interface ContentDiscoveryProps {
    apiKey: string;
    onSearch: (keyword: string, minRatio: number) => Promise<void>;
    isLoading: boolean;
    videos: ContentDiscoveryVideo[];
    onCollectComments: (videoId: string) => Promise<void>;
    comments: VideoComment[];
    selectedVideo: ContentDiscoveryVideo | null;
    onGenerateIdeas: () => Promise<void>;
    contentIdeas: ContentIdea[];
    isGeneratingIdeas: boolean;
    onGenerateOutline: (idea: ContentIdea) => Promise<void>;
    scriptOutline: ScriptOutline | null;
    isGeneratingOutline: boolean;
}

const ContentDiscovery: React.FC<ContentDiscoveryProps> = ({
    apiKey,
    onSearch,
    isLoading,
    videos,
    onCollectComments,
    comments,
    selectedVideo,
    onGenerateIdeas,
    contentIdeas,
    isGeneratingIdeas,
    onGenerateOutline,
    scriptOutline,
    isGeneratingOutline,
}) => {
    const [keyword, setKeyword] = useState('');
    const [minRatio, setMinRatio] = useState(10);
    const [showComments, setShowComments] = useState(true);
    const [copiedOutline, setCopiedOutline] = useState(false);

    const handleSearch = () => {
        if (keyword.trim()) {
            onSearch(keyword, minRatio);
        }
    };

    const handleCopyOutline = () => {
        if (!scriptOutline) return;

        const outlineText = `# ${scriptOutline.title}\n\n예상 길이: ${scriptOutline.estimatedDuration}\n\n${scriptOutline.sections.map((section, idx) =>
            `## ${idx + 1}. ${section.title} (${section.estimatedTime})\n${section.keyPoints.map(point => `- ${point}`).join('\n')}`
        ).join('\n\n')}`;

        navigator.clipboard.writeText(outlineText).then(() => {
            setCopiedOutline(true);
            setTimeout(() => setCopiedOutline(false), 2000);
        });
    };

    const getInterestBadge = (interest: string) => {
        const colors = {
            high: 'bg-red-600',
            medium: 'bg-yellow-600',
            low: 'bg-gray-600',
        };
        const labels = {
            high: '높음',
            medium: '보통',
            low: '낮음',
        };
        return (
            <span className={`px-2 py-1 text-xs rounded ${colors[interest as keyof typeof colors] || colors.low}`}>
                관심도: {labels[interest as keyof typeof labels] || '알 수 없음'}
            </span>
        );
    };

    return (
        <div className="space-y-6">
            {/* 검색 섹션 */}
            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                <h2 className="text-xl font-bold mb-4">🔍 소재 발굴 검색</h2>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">키워드</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={keyword}
                                onChange={(e) => setKeyword(e.target.value)}
                                placeholder="예: 브이로그, 코딩, 요리"
                                className="flex-1 p-3 bg-gray-700 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            />
                            <button
                                onClick={handleSearch}
                                disabled={isLoading || !keyword.trim()}
                                className="px-6 py-3 bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-wait font-bold transition-colors"
                            >
                                {isLoading ? '검색 중...' : '검색'}
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            구독자 대비 조회수 비율 (최소 {minRatio}배)
                        </label>
                        <div className="flex items-center gap-4">
                            <input
                                type="range"
                                min="1"
                                max="100"
                                value={minRatio}
                                onChange={(e) => setMinRatio(Number(e.target.value))}
                                className="flex-1"
                            />
                            <span className="text-lg font-bold text-blue-400 w-20 text-right">{minRatio}배</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                            예: 10배 = 구독자 1만명인데 조회수 10만 이상인 영상 (알고리즘 타는 영상)
                        </p>
                    </div>
                </div>
            </div>

            {/* 영상 목록 */}
            {videos.length > 0 && (
                <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                    <h2 className="text-xl font-bold mb-4">
                        📊 알고리즘 타는 영상 ({videos.length}개)
                    </h2>
                    <div className="space-y-4">
                        {videos.map((video) => (
                            <div
                                key={video.id}
                                className={`bg-gray-700 p-4 rounded-lg border ${selectedVideo?.id === video.id ? 'border-blue-500' : 'border-gray-600'
                                    }`}
                            >
                                <div className="flex items-start gap-4">
                                    <img
                                        src={video.thumbnail}
                                        alt={video.title}
                                        className="w-40 h-24 object-cover rounded flex-shrink-0"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <a
                                            href={`https://www.youtube.com/watch?v=${video.id}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-sm font-semibold text-white hover:text-blue-400 line-clamp-2 block mb-2"
                                        >
                                            {video.title}
                                        </a>
                                        <div className="text-xs text-gray-400 space-y-1">
                                            <div>채널: {video.channelTitle}</div>
                                            <div className="flex gap-4 flex-wrap">
                                                <span>구독자: {video.channelSubscriberCount.toLocaleString()}</span>
                                                <span>조회수: {video.viewCount.toLocaleString()}</span>
                                                <span className="font-bold text-yellow-400">
                                                    비율: {video.subscriberViewRatio.toFixed(1)}배
                                                </span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => onCollectComments(video.id)}
                                            disabled={isLoading}
                                            className="mt-3 px-4 py-2 text-xs bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 rounded transition-colors"
                                        >
                                            💬 댓글 수집 및 분석
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 댓글 섹션 */}
            {comments.length > 0 && (
                <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold">
                            💬 수집된 댓글 ({comments.length}개)
                        </h2>
                        <button
                            onClick={() => setShowComments(!showComments)}
                            className="text-sm text-blue-400 hover:text-blue-300"
                        >
                            {showComments ? '접기' : '펼치기'}
                        </button>
                    </div>

                    {showComments && (
                        <div className="space-y-2 max-h-96 overflow-y-auto mb-4">
                            {comments.slice(0, 20).map((comment) => (
                                <div key={comment.id} className="bg-gray-700 p-3 rounded text-sm">
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="font-semibold text-gray-300">{comment.author}</span>
                                        <span className="text-xs text-gray-500">
                                            👍 {comment.likeCount}
                                        </span>
                                    </div>
                                    <div
                                        className="text-gray-400 text-xs"
                                        dangerouslySetInnerHTML={{ __html: comment.text }}
                                    />
                                </div>
                            ))}
                            {comments.length > 20 && (
                                <p className="text-xs text-gray-500 text-center">
                                    ...외 {comments.length - 20}개 댓글
                                </p>
                            )}
                        </div>
                    )}

                    <button
                        onClick={onGenerateIdeas}
                        disabled={isGeneratingIdeas}
                        className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-purple-800 disabled:to-blue-800 rounded-md font-bold transition-colors"
                    >
                        {isGeneratingIdeas ? '✨ AI 분석 중...' : '✨ AI 소재 추천 받기'}
                    </button>
                </div>
            )}

            {/* AI 추천 소재 */}
            {contentIdeas.length > 0 && (
                <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                    <h2 className="text-xl font-bold mb-4">💡 AI 추천 콘텐츠 아이디어</h2>
                    <div className="space-y-4">
                        {contentIdeas.map((idea) => (
                            <div key={idea.id} className="bg-gray-700 p-4 rounded-lg border border-gray-600">
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="text-lg font-bold text-white">{idea.title}</h3>
                                    {getInterestBadge(idea.estimatedInterest)}
                                </div>
                                <p className="text-sm text-gray-300 mb-2">{idea.description}</p>
                                <p className="text-xs text-gray-400 mb-3">
                                    <strong>추천 이유:</strong> {idea.reasoning}
                                </p>
                                <button
                                    onClick={() => onGenerateOutline(idea)}
                                    disabled={isGeneratingOutline}
                                    className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 disabled:bg-green-800 rounded transition-colors"
                                >
                                    {isGeneratingOutline ? '📝 생성 중...' : '📝 대본 목차 생성'}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 대본 목차 */}
            {scriptOutline && (
                <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold">📝 대본 목차</h2>
                        <button
                            onClick={handleCopyOutline}
                            className={`px-4 py-2 rounded-md text-sm font-semibold transition-all ${copiedOutline
                                    ? 'bg-green-600 text-white'
                                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                }`}
                        >
                            {copiedOutline ? '✓ 복사 완료!' : '📋 복사'}
                        </button>
                    </div>

                    <div className="bg-gray-900 p-4 rounded-lg">
                        <h3 className="text-2xl font-bold text-white mb-2">{scriptOutline.title}</h3>
                        <p className="text-sm text-gray-400 mb-4">
                            예상 길이: {scriptOutline.estimatedDuration}
                        </p>

                        <div className="space-y-4">
                            {scriptOutline.sections.map((section, idx) => (
                                <div key={idx} className="border-l-4 border-blue-500 pl-4">
                                    <div className="flex justify-between items-center mb-2">
                                        <h4 className="text-lg font-bold text-white">
                                            {idx + 1}. {section.title}
                                        </h4>
                                        <span className="text-xs text-gray-500">{section.estimatedTime}</span>
                                    </div>
                                    <ul className="list-disc list-inside space-y-1">
                                        {section.keyPoints.map((point, pointIdx) => (
                                            <li key={pointIdx} className="text-sm text-gray-300">
                                                {point}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ContentDiscovery;
