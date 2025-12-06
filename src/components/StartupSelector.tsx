import React, { useState } from 'react';
import { StartupCandidate } from '../types';
import { Globe, ArrowRight, X, Linkedin } from 'lucide-react';

interface Props {
  candidates: StartupCandidate[];
  onSelect: (candidate: StartupCandidate) => void;
  onCancel: () => void;
  help?: {
    alwaysVisible?: boolean;
    infoToggleLabel?: string;
    examples?: { input: string; result: string }[];
    proTips?: string[];
    mandateEffect?: string;
    whyThisWorked?: string;
  };
}

const StartupSelector: React.FC<Props> = ({ candidates, onSelect, onCancel, help }) => {
  const [showHelp, setShowHelp] = useState(false);

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
      <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
        <h3 className="text-white font-semibold">Select Startup to Evaluate</h3>
        <button onClick={onCancel} className="text-slate-400 hover:text-white">
          <X className="w-5 h-5" />
        </button>
      </div>
      
      <div className="p-2">
        {candidates.length === 0 ? (
           <div className="p-8 text-center text-slate-400">
             No startups found matching that description. Try refining your search.
           </div>
        ) : (
          candidates.map((candidate) => {
            const isLinkedin = candidate.url?.toLowerCase().includes('linkedin.com');
            
            return (
              <div 
                key={candidate.id}
                onClick={() => onSelect(candidate)}
                className="group flex items-start gap-4 p-4 rounded-lg hover:bg-slate-700/50 cursor-pointer transition-colors border border-transparent hover:border-slate-600"
              >
                <div className={`mt-1 w-10 h-10 rounded-full flex items-center justify-center transition-colors 
                  ${isLinkedin 
                    ? 'bg-blue-900/30 text-blue-400 group-hover:bg-blue-600 group-hover:text-white' 
                    : 'bg-violet-900/30 text-violet-400 group-hover:bg-violet-600 group-hover:text-white'}`}
                >
                  {isLinkedin ? <Linkedin className="w-5 h-5" /> : <Globe className="w-5 h-5" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                      <h4 className="text-white font-medium group-hover:text-violet-300 transition-colors">{candidate.name}</h4>
                      {candidate.url && (
                          <span className="text-xs text-slate-500 truncate max-w-[200px]">{new URL(candidate.url).hostname}</span>
                      )}
                  </div>
                  <p className="text-sm text-slate-400 mt-1 line-clamp-2">{candidate.description}</p>
                </div>
                <div className="self-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <ArrowRight className="w-5 h-5 text-violet-400" />
                </div>
              </div>
            );
          })
        )}
      </div>
      
      <div className="p-3 bg-slate-900/30 border-t border-slate-800 text-center">
        <button onClick={onCancel} className="text-xs text-slate-500 hover:text-slate-300">
          None of these? Cancel and search again.
        </button>
      </div>

      {/* Help affordance removed: structured form supplies context now */}
    </div>
  );
};

export default StartupSelector;