
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
        <p className="text-purple-400 font-semibold">{`인기도: ${data.popularityScore}`}</p>
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
      <h3 className="text-xl font-bold mb-6 text-white">영상 데이터 시각화</h3>
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
    </div>
  );
};

export default AnalysisChart;
