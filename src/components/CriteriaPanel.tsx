import React, { useState } from 'react';
import { Answer } from '../types';
import { ChevronDown, ChevronUp, Target, Sliders, ShieldAlert, ListFilter } from 'lucide-react';

interface Props {
  topic: string;
  answers: Answer[];
  refinementRules: string[];
}

const CriteriaPanel: React.FC<Props> = ({ topic, answers, refinementRules }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-slate-800 border-b border-slate-700 shadow-sm relative z-40">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between text-slate-400 hover:text-white transition-colors group"
      >
        <div className="flex items-center gap-3 text-sm font-medium">
            <div className="p-1 bg-slate-700 group-hover:bg-slate-600 rounded">
                <ListFilter className="w-4 h-4" />
            </div>
            <span>Criteria Reference & Mandate Profile</span>
            <span className="bg-violet-900/50 text-violet-300 border border-violet-800 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase">
                {answers.length + refinementRules.length} Active Rules
            </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 group-hover:text-slate-300">
            {isOpen ? 'Collapse Review' : 'View Criteria'}
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {isOpen && (
        <div className="bg-slate-900/50 border-t border-slate-700/50 animate-in slide-in-from-top-2 duration-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 grid grid-cols-1 md:grid-cols-3 gap-8">
                
                {/* Topic */}
                <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/30">
                    <h4 className="text-violet-400 text-xs font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Target className="w-3 h-3" /> Mandate Focus
                    </h4>
                    <p className="text-white text-sm font-medium leading-relaxed">
                        "{topic}"
                    </p>
                </div>

                {/* Calibration */}
                <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/30">
                     <h4 className="text-emerald-400 text-xs font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Sliders className="w-3 h-3" /> Calibration Settings
                    </h4>
                    <ul className="space-y-4">
                        {answers.map((ans, i) => (
                            <li key={i} className="text-sm">
                                <p className="text-slate-500 text-xs font-semibold uppercase mb-1">{ans.questionText}</p>
                                <div className="text-slate-300 border-l-2 border-emerald-500/30 pl-3 py-0.5 text-xs italic">
                                    "{ans.answerText}"
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Refinements */}
                <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/30">
                    <h4 className="text-amber-400 text-xs font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
                        <ShieldAlert className="w-3 h-3" /> Adaptive Rules
                    </h4>
                    {refinementRules.length === 0 ? (
                        <p className="text-slate-500 text-sm italic py-2">No refinement rules added yet.</p>
                    ) : (
                        <ul className="space-y-3">
                            {refinementRules.map((rule, i) => (
                                <li key={i} className="text-sm text-slate-300 flex items-start gap-2 bg-amber-900/10 p-2 rounded border border-amber-900/20">
                                    <span className="text-amber-500 mt-0.5">•</span>
                                    <span className="text-xs leading-relaxed">{rule}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default CriteriaPanel;