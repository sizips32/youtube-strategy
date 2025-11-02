
import React from 'react';
import { VideoData } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Line } from 'recharts';

interface AnalysisChartProps {
  data: VideoData[];
}

const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-gray-800 p-4 border border-gray-600 rounded shadow-lg text-sm">
        <p className="font-bold text-white mb-2 truncate max-w-xs">{data.title}</p>
        <p className="text-blue-400">{`조회수: ${data.viewCount.toLocaleString()}`}</p>
        <p className="text-green-400">{`좋아요: ${data.likeCount.toLocaleString()}`}</p>
        <p className="text-yellow-400">{`댓글: ${data.commentCount.toLocaleString()}`}</p>
        <div className="mt-2 pt-2 border-t border-gray-600">
          <p className="text-purple-400 font-semibold">{`인기도: ${data.popularityScore}`}</p>
          <p className="text-xs text-gray-500 mt-1">
            (좋아요 60% + 댓글 40%) ÷ 조회수 × 1000
          </p>
        </div>
      </div>
    );
  }
  return null;
};

const AnalysisChart: React.FC<AnalysisChartProps> = ({ data }) => {
  if (data.length === 0) {
    return null;
  }
  
  const chartData = data.map((video, index) => ({
      ...video,
      name: `영상 ${index + 1}`
  }));

  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700 mt-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-white">영상 데이터 시각화</h3>
        <div className="group relative">
          <button className="text-gray-400 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          <div className="absolute right-0 top-full mt-2 w-64 p-3 bg-gray-900 border border-gray-600 rounded-lg shadow-xl z-10 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 text-xs">
            <div className="font-bold text-purple-400 mb-2">인기도 점수 계산 방식</div>
            <div className="text-gray-300 space-y-1">
              <p>인기도 점수는 <strong className="text-white">조회수 대비 참여율</strong>을 나타냅니다.</p>
              <p className="mt-2"><strong className="text-white">공식:</strong></p>
              <p className="font-mono text-purple-300">(좋아요 × 0.6 + 댓글 × 0.4) ÷ 조회수 × 1000</p>
              <p className="mt-2 text-yellow-400">• 높은 점수: 시청자 참여가 활발함</p>
              <p className="text-yellow-400">• 낮은 점수: 조회수 대비 참여가 부족함</p>
              <p className="mt-2 text-gray-400 text-xs">좋아요와 댓글에 가중치를 두어 참여 품질을 측정합니다.</p>
            </div>
          </div>
        </div>
      </div>
      <div style={{ width: '100%', height: 400 }}>
        <ResponsiveContainer>
          <ComposedChart
            data={chartData}
            margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#4A5568" />
            <XAxis dataKey="name" stroke="#A0AEC0" />
            <YAxis yAxisId="left" orientation="left" stroke="#A0AEC0" label={{ value: '조회수/좋아요/댓글', angle: -90, position: 'insideLeft', fill: '#A0AEC0', dx: -10 }} />
            <YAxis yAxisId="right" orientation="right" stroke="#A0AEC0" label={{ value: '인기도 점수', angle: 90, position: 'insideRight', fill: '#A0AEC0', dx: 10 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ color: '#A0AEC0' }} />
            <Bar yAxisId="left" dataKey="viewCount" fill="#4299E1" name="조회수" />
            <Bar yAxisId="left" dataKey="likeCount" fill="#48BB78" name="좋아요" />
            <Bar yAxisId="left" dataKey="commentCount" fill="#F6E05E" name="댓글 수" />
            <Line yAxisId="right" type="monotone" dataKey="popularityScore" stroke="#9F7AEA" strokeWidth={2} name="인기도 점수" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 p-3 bg-gray-900/50 rounded border border-gray-700 text-sm text-gray-400">
        <div className="flex items-start">
          <span className="text-purple-400 font-semibold mr-2">💡 인기도 점수:</span>
          <div className="flex-1">
            <span className="text-gray-300">조회수 대비 시청자 참여율을 측정합니다. </span>
            <span className="text-gray-400">(좋아요 60% + 댓글 40% 가중 평균 ÷ 조회수 × 1000)</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalysisChart;
