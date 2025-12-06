import React from 'react';
import { EvaluationResult, Mandate } from '../types';
import { X } from 'lucide-react';

interface Props {
  startupName: string;
  evaluations: EvaluationResult[];
  mandates: Mandate[];
  onClose: () => void;
}

const ComparisonView: React.FC<Props> = ({ startupName, evaluations, mandates, onClose }) => {
  const getMandateName = (mandateId?: string) => {
    if (!mandateId) return 'Unknown Mandate';
    const mandate = mandates.find(m => m.id === mandateId);
    return mandate?.name || 'Unknown Mandate';
  };

  const getScoreColor = (score: number) => {
    if (score >= 4.5) return 'text-green-400';
    if (score >= 3.5) return 'text-yellow-400';
    if (score >= 2.5) return 'text-orange-400';
    return 'text-red-400';
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700 bg-slate-800/50">
          <div>
            <h2 className="text-2xl font-bold text-white">{startupName}</h2>
            <p className="text-sm text-slate-400 mt-1">Evaluated across {evaluations.length} mandate(s)</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-auto flex-1 p-6">
          {evaluations.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <p>No evaluations found for this startup</p>
            </div>
          ) : (
            <div className="space-y-4">
              {evaluations.map((ev, idx) => (
                <div
                  key={idx}
                  className="bg-slate-800/50 border border-slate-700 rounded-lg p-5 space-y-4"
                >
                  {/* Mandate Name */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-white">{getMandateName(ev.mandateId)}</h3>
                      <p className="text-xs text-slate-500 mt-1">
                        {ev.evaluatedAt ? new Date(ev.evaluatedAt).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                  </div>

                  {/* Summary */}
                  <p className="text-sm text-slate-300">{ev.oneLineSummary}</p>

                  {/* Scores Grid */}
                  <div className="grid grid-cols-4 gap-3">
                    <div className="bg-slate-900/50 rounded p-3 text-center">
                      <div className="text-xs text-slate-400 font-medium mb-1">Desirability</div>
                      <div className={`text-2xl font-bold ${getScoreColor(ev.desirability.score)}`}>
                        {ev.desirability.score}
                      </div>
                    </div>
                    <div className="bg-slate-900/50 rounded p-3 text-center">
                      <div className="text-xs text-slate-400 font-medium mb-1">Viability</div>
                      <div className={`text-2xl font-bold ${getScoreColor(ev.viability.score)}`}>
                        {ev.viability.score}
                      </div>
                    </div>
                    <div className="bg-slate-900/50 rounded p-3 text-center">
                      <div className="text-xs text-slate-400 font-medium mb-1">Feasibility</div>
                      <div className={`text-2xl font-bold ${getScoreColor(ev.feasibility.score)}`}>
                        {ev.feasibility.score}
                      </div>
                    </div>
                    <div className="bg-violet-900/30 border border-violet-500/30 rounded p-3 text-center">
                      <div className="text-xs text-slate-400 font-medium mb-1">Overall</div>
                      <div className={`text-2xl font-bold ${getScoreColor(ev.overallScore)}`}>
                        {ev.overallScore.toFixed(1)}
                      </div>
                    </div>
                  </div>

                  {/* Red Flags */}
                  {ev.redFlags.length > 0 && (
                    <div className="bg-rose-900/20 border border-rose-500/30 rounded p-3">
                      <div className="text-xs font-semibold text-rose-400 uppercase mb-2">Red Flags</div>
                      <ul className="space-y-1">
                        {ev.redFlags.map((flag, i) => (
                          <li key={i} className="text-sm text-rose-200 flex gap-2">
                            <span>•</span>
                            <span>{flag}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* No-Go Status */}
                  {ev.isNoGo && (
                    <div className="bg-red-900/20 border border-red-500/30 rounded p-3">
                      <div className="text-sm font-semibold text-red-400">❌ NO-GO Decision</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ComparisonView;
