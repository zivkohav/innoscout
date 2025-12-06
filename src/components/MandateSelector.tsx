import React, { useState } from 'react';
import { Mandate } from '../types';
import { ChevronDown, Plus, Trash2 } from 'lucide-react';

interface Props {
  mandates: Mandate[];
  activeMandateId: string | null;
  onSelectMandate: (mandateId: string) => void;
  onCreateNew: () => void;
  onDeleteMandate: (mandateId: string) => void;
}

const MandateSelector: React.FC<Props> = ({
  mandates,
  activeMandateId,
  onSelectMandate,
  onCreateNew,
  onDeleteMandate,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const activeMandate = mandates.find(m => m.id === activeMandateId);

  return (
    <div className="relative inline-block w-full md:w-auto">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full md:w-auto flex items-center justify-between gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-200 transition-colors"
      >
        <div className="flex items-center gap-2 flex-1">
          <div className="w-2 h-2 bg-violet-500 rounded-full"></div>
          <span className="text-sm font-medium truncate">
            {activeMandate?.name || 'Select Mandate'}
          </span>
        </div>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 left-0 right-0 md:w-80 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl z-50 max-h-96 overflow-y-auto">
          {/* Mandates List */}
          <div className="p-2">
            {mandates.length === 0 ? (
              <div className="px-3 py-2 text-sm text-slate-400">No mandates yet</div>
            ) : (
              mandates.map(mandate => (
                <div
                  key={mandate.id}
                  className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg transition-colors ${
                    mandate.id === activeMandateId
                      ? 'bg-violet-900/30 border border-violet-500/30'
                      : 'hover:bg-slate-800'
                  }`}
                >
                  <button
                    onClick={() => {
                      onSelectMandate(mandate.id);
                      setIsOpen(false);
                    }}
                    className="flex-1 text-left"
                  >
                    <div className="text-sm font-medium text-white">{mandate.name}</div>
                    <div className="text-xs text-slate-400 truncate">{mandate.innovationTopic}</div>
                  </button>
                  <button
                    onClick={() => {
                      onDeleteMandate(mandate.id);
                      setIsOpen(false);
                    }}
                    className="p-1.5 rounded hover:bg-rose-900/30 text-slate-400 hover:text-rose-400 transition-colors"
                    title="Delete mandate"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-slate-700 my-1"></div>

          {/* Create New */}
          <button
            onClick={() => {
              onCreateNew();
              setIsOpen(false);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-violet-400 hover:bg-slate-800 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            <span>New Mandate</span>
          </button>
        </div>
      )}

      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        ></div>
      )}
    </div>
  );
};

export default MandateSelector;
