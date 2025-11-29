import React from 'react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from 'recharts';
import { EvaluationResult } from '../types';

interface CriteriaChartProps {
  evaluation: EvaluationResult;
}

const CriteriaChart: React.FC<CriteriaChartProps> = ({ evaluation }) => {
  const data = [
    { subject: 'Desirability', A: evaluation.desirability.score, fullMark: 5 },
    { subject: 'Viability', A: evaluation.viability.score, fullMark: 5 },
    { subject: 'Feasibility', A: evaluation.feasibility.score, fullMark: 5 },
  ];

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
          <PolarGrid stroke="#475569" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: '#cbd5e1', fontSize: 12, fontWeight: 'bold' }} />
          <PolarRadiusAxis angle={30} domain={[0, 5]} tick={false} axisLine={false} />
          <Radar
            name={evaluation.startupName}
            dataKey="A"
            stroke="#8b5cf6"
            strokeWidth={3}
            fill="#8b5cf6"
            fillOpacity={0.4}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default CriteriaChart;