import React, { useState, useMemo } from 'react';
import {
  ShortsData,
  ShortsSummary,
  ShortsPerformance,
  ChannelInfo,
} from '../types';

interface ShortsManagementProps {
  channelInfo: ChannelInfo | null;
  shorts: ShortsData[];
  summary: ShortsSummary;
  isLoading: boolean;
  onGenerateAIAdvice: (videoId: string) => void;
  aiAdvice: { [videoId: string]: string };
}

type SortBy = 'views' | 'engagement' | 'date' | 'performance';
type FilterBy = 'all' | ShortsPerformance;

const ShortsManagement: React.FC<ShortsManagementProps> = ({
  channelInfo,
  shorts,
  summary,
  isLoading,
  onGenerateAIAdvice,
  aiAdvice,
}) => {
  const [sortBy, setSortBy] = useState<SortBy>('views');
  const [filterBy, setFilterBy] = useState<FilterBy>('all');
  const [expandedVideo, setExpandedVideo] = useState<string | null>(null);

  // 필터링 및 정렬
  const filteredAndSortedShorts = useMemo(() => {
    let filtered = filterBy === 'all'
      ? shorts
      : shorts.filter(s => s.performance === filterBy);

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'views':
          return b.viewCount - a.viewCount;
        case 'engagement':
          return b.engagementRate - a.engagementRate;
        case 'date':
          return new Date(b.publishedAt || '').getTime() - new Date(a.publishedAt || '').getTime();
        case 'performance':
          const perfOrder = {
            [ShortsPerformance.VIRAL]: 0,
            [ShortsPerformance.EXCELLENT]: 1,
            [ShortsPerformance.GOOD]: 2,
            [ShortsPerformance.AVERAGE]: 3,
            [ShortsPerformance.POOR]: 4,
          };
          return perfOrder[a.performance] - perfOrder[b.performance];
        default:
          return 0;
      }
    });
  }, [shorts, sortBy, filterBy]);

  // 성능 등급별 색상
  const getPerformanceColor = (performance: ShortsPerformance) => {
    switch (performance) {
      case ShortsPerformance.VIRAL:
        return 'text-purple-400 bg-purple-900/30 border-purple-500';
      case ShortsPerformance.EXCELLENT:
        return 'text-green-400 bg-green-900/30 border-green-500';
      case ShortsPerformance.GOOD:
        return 'text-blue-400 bg-blue-900/30 border-blue-500';
      case ShortsPerformance.AVERAGE:
        return 'text-yellow-400 bg-yellow-900/30 border-yellow-500';
      case ShortsPerformance.POOR:
        return 'text-red-400 bg-red-900/30 border-red-500';
    }
  };

  // 성능 등급 한글 라벨
  const getPerformanceLabel = (performance: ShortsPerformance) => {
    switch (performance) {
      case ShortsPerformance.VIRAL:
        return '바이럴';
      case ShortsPerformance.EXCELLENT:
        return '우수';
      case ShortsPerformance.GOOD:
        return '양호';
      case ShortsPerformance.AVERAGE:
        return '평균';
      case ShortsPerformance.POOR:
        return '부진';
    }
  };

  // 숫자 포맷팅
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  // 날짜 포맷팅
  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="text-gray-400 text-lg">분석 중...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 채널 정보 */}
      {channelInfo && (
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center space-x-4">
            <img
              src={channelInfo.thumbnail}
              alt={channelInfo.title}
              className="w-16 h-16 rounded-full"
            />
            <div>
              <h2 className="text-2xl font-bold text-white">{channelInfo.title}</h2>
              <p className="text-gray-400">
                구독자 {formatNumber(channelInfo.subscriberCount || 0)} ·
                전체 조회수 {formatNumber(channelInfo.totalViewCount || 0)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 쇼츠 통계 대시보드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-gray-400 text-sm mb-1">총 쇼츠 수</div>
          <div className="text-3xl font-bold text-white">{summary.totalShorts}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-gray-400 text-sm mb-1">평균 조회수</div>
          <div className="text-3xl font-bold text-white">{formatNumber(summary.avgViews)}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-gray-400 text-sm mb-1">평균 참여율</div>
          <div className="text-3xl font-bold text-white">{(summary.avgEngagement * 100).toFixed(2)}%</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-gray-400 text-sm mb-1">바이럴 쇼츠</div>
          <div className="text-3xl font-bold text-purple-400">{summary.viralCount}</div>
        </div>
      </div>

      {/* 최고/최저 성과 쇼츠 */}
      <div className="grid md:grid-cols-2 gap-4">
        {summary.bestPerformer && (
          <div className="bg-gradient-to-br from-green-900/20 to-gray-800 rounded-lg p-4 border border-green-700">
            <div className="text-green-400 font-semibold mb-2">🏆 최고 성과 쇼츠</div>
            <div className="text-white font-medium truncate">{summary.bestPerformer.title}</div>
            <div className="text-gray-300 text-sm mt-2">
              조회수 {formatNumber(summary.bestPerformer.viewCount)} ·
              참여율 {(summary.bestPerformer.engagementRate * 100).toFixed(2)}%
            </div>
          </div>
        )}
        {summary.worstPerformer && (
          <div className="bg-gradient-to-br from-red-900/20 to-gray-800 rounded-lg p-4 border border-red-700">
            <div className="text-red-400 font-semibold mb-2">📉 개선 필요 쇼츠</div>
            <div className="text-white font-medium truncate">{summary.worstPerformer.title}</div>
            <div className="text-gray-300 text-sm mt-2">
              조회수 {formatNumber(summary.worstPerformer.viewCount)} ·
              참여율 {(summary.worstPerformer.engagementRate * 100).toFixed(2)}%
            </div>
          </div>
        )}
      </div>

      {/* AI 추천사항 */}
      {summary.recommendations.length > 0 && (
        <div className="bg-gradient-to-br from-blue-900/20 to-gray-800 rounded-lg p-6 border border-blue-700">
          <h3 className="text-xl font-bold text-blue-400 mb-3">💡 AI 추천사항</h3>
          <ul className="space-y-2">
            {summary.recommendations.map((rec, idx) => (
              <li key={idx} className="text-gray-300 flex items-start">
                <span className="text-blue-400 mr-2">•</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 필터 및 정렬 컨트롤 */}
      <div className="flex flex-wrap gap-4 items-center justify-between bg-gray-800 p-4 rounded-lg border border-gray-700">
        <div className="flex gap-2 flex-wrap">
          <span className="text-gray-400 self-center">필터:</span>
          <button
            onClick={() => setFilterBy('all')}
            className={`px-3 py-1 rounded-md text-sm transition-colors ${
              filterBy === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            전체
          </button>
          {Object.values(ShortsPerformance).map((perf) => (
            <button
              key={perf}
              onClick={() => setFilterBy(perf)}
              className={`px-3 py-1 rounded-md text-sm transition-colors ${
                filterBy === perf ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {getPerformanceLabel(perf)}
            </button>
          ))}
        </div>

        <div className="flex gap-2 flex-wrap">
          <span className="text-gray-400 self-center">정렬:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="bg-gray-700 text-white px-3 py-1 rounded-md text-sm border border-gray-600 focus:outline-none focus:border-blue-500"
          >
            <option value="views">조회수순</option>
            <option value="engagement">참여율순</option>
            <option value="date">최신순</option>
            <option value="performance">성과순</option>
          </select>
        </div>
      </div>

      {/* 쇼츠 리스트 */}
      <div className="space-y-4">
        <h3 className="text-xl font-bold text-white">
          쇼츠 목록 ({filteredAndSortedShorts.length}개)
        </h3>
        {filteredAndSortedShorts.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            필터에 맞는 쇼츠가 없습니다.
          </div>
        ) : (
          filteredAndSortedShorts.map((short) => (
            <div
              key={short.id}
              className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden hover:border-gray-600 transition-colors"
            >
              {/* 쇼츠 기본 정보 */}
              <div className="p-4">
                <div className="flex gap-4">
                  {/* 썸네일 */}
                  <div className="flex-shrink-0">
                    <img
                      src={short.thumbnail}
                      alt={short.title}
                      className="w-32 h-48 object-cover rounded-md"
                    />
                  </div>

                  {/* 정보 */}
                  <div className="flex-grow min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h4 className="text-white font-semibold text-lg line-clamp-2">
                        {short.title}
                      </h4>
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold border flex-shrink-0 ${getPerformanceColor(
                          short.performance
                        )}`}
                      >
                        {getPerformanceLabel(short.performance)}
                      </span>
                    </div>

                    <div className="text-sm text-gray-400 mb-3">
                      {formatDate(short.publishedAt)} · {short.duration}초
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                      <div>
                        <div className="text-gray-500 text-xs">조회수</div>
                        <div className="text-white font-semibold">{formatNumber(short.viewCount)}</div>
                      </div>
                      <div>
                        <div className="text-gray-500 text-xs">좋아요</div>
                        <div className="text-white font-semibold">{formatNumber(short.likeCount)}</div>
                      </div>
                      <div>
                        <div className="text-gray-500 text-xs">댓글</div>
                        <div className="text-white font-semibold">{formatNumber(short.commentCount)}</div>
                      </div>
                      <div>
                        <div className="text-gray-500 text-xs">참여율</div>
                        <div className="text-white font-semibold">
                          {(short.engagementRate * 100).toFixed(2)}%
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <a
                        href={`https://www.youtube.com/shorts/${short.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded-md transition-colors"
                      >
                        YouTube에서 보기
                      </a>
                      <button
                        onClick={() => setExpandedVideo(expandedVideo === short.id ? null : short.id)}
                        className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-md transition-colors"
                      >
                        {expandedVideo === short.id ? '접기' : '상세 분석'}
                      </button>
                      <button
                        onClick={() => onGenerateAIAdvice(short.id)}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md transition-colors"
                      >
                        AI 개선 제안
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* 확장된 상세 정보 */}
              {expandedVideo === short.id && (
                <div className="border-t border-gray-700 p-4 bg-gray-900/50">
                  <h5 className="text-white font-semibold mb-2">상세 정보</h5>

                  {short.description && (
                    <div className="mb-3">
                      <div className="text-gray-400 text-sm mb-1">설명</div>
                      <div className="text-gray-300 text-sm line-clamp-3">{short.description}</div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <div className="text-gray-400 text-sm mb-1">인기도 점수</div>
                      <div className="text-white">{short.popularityScore.toFixed(2)}</div>
                    </div>
                    {short.hookEffectiveness !== undefined && (
                      <div>
                        <div className="text-gray-400 text-sm mb-1">훅 효과성</div>
                        <div className="text-white">{short.hookEffectiveness.toFixed(2)}</div>
                      </div>
                    )}
                    {short.retentionScore !== undefined && (
                      <div>
                        <div className="text-gray-400 text-sm mb-1">예상 시청 유지율</div>
                        <div className="text-white">{(short.retentionScore * 100).toFixed(1)}%</div>
                      </div>
                    )}
                  </div>

                  {aiAdvice[short.id] && (
                    <div className="mt-4 p-3 bg-blue-900/20 border border-blue-700 rounded-md">
                      <div className="text-blue-400 font-semibold mb-2">🤖 AI 개선 제안</div>
                      <div className="text-gray-300 text-sm whitespace-pre-wrap">{aiAdvice[short.id]}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ShortsManagement;
