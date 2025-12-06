import React from 'react';
import { EvaluationResult } from '../types';

// Lightweight date helpers to avoid adding a dependency
const parseISO = (s?: string) => (s ? new Date(s) : new Date());
const isToday = (d: Date) => {
  const today = new Date();
  return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
};
const differenceInDays = (a: Date, b: Date) => Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
const format = (d: Date, _fmt: string) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

interface Props {
  items: EvaluationResult[];
  mandateId?: string | null;
  onSelect?: (evaluation: EvaluationResult) => void;
}

const groupByDate = (items: EvaluationResult[], mandateId?: string | null) => {
  // Filter items to only those matching current mandate
  const filtered = mandateId 
    ? items.filter(it => it.mandateId === mandateId)
    : items.filter(it => !it.mandateId); // Show untagged items if no mandate

  const groups: Record<string, EvaluationResult[]> = {
    Today: [],
    'Last Week': [],
    'Last Month': [],
    Older: [],
  };

  filtered.forEach((it) => {
    const dt = it.evaluatedAt ? parseISO(it.evaluatedAt) : new Date();
    if (isToday(dt)) {
      groups.Today.push(it);
      return;
    }
    const days = differenceInDays(new Date(), dt);
    if (days <= 7) groups['Last Week'].push(it);
    else if (days <= 30) groups['Last Month'].push(it);
    else groups.Older.push(it);
  });

  return groups;
};

const SmallItem = ({ ev, onClick }: { ev: EvaluationResult; onClick?: (e: EvaluationResult) => void }) => (
  <button onClick={() => onClick?.(ev)} className="w-full text-left p-2 rounded hover:bg-slate-800/40 transition-colors flex items-center justify-between">
    <div>
      <div className="text-sm text-white font-medium">{ev.startupName}</div>
      <div className="text-[11px] text-slate-400">{ev.oneLineSummary}</div>
    </div>
    <div className="text-right ml-3">
      <div className="text-sm font-semibold text-slate-200">{ev.overallScore}/5</div>
      <div className="text-[11px] text-slate-400">{ev.evaluatedAt ? format(new Date(ev.evaluatedAt), 'MMM d') : ''}</div>
    </div>
  </button>
);

const SearchHistory: React.FC<Props> = ({ items, mandateId, onSelect }) => {
  const groups = groupByDate(items, mandateId);

  return (
    <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4 space-y-3 max-h-[60vh] overflow-auto">
      <h4 className="text-sm font-bold text-white">Previous Searches</h4>
      {Object.entries(groups).map(([label, list]) => (
        <div key={label}>
          <div className="text-xs text-slate-400 font-medium uppercase tracking-wide mt-2 mb-1">{label} ({list.length})</div>
          <div className="space-y-2">
            {list.length === 0 ? (
              <div className="text-xs text-slate-500">No items</div>
            ) : (
              list.map((ev, idx) => <SmallItem key={ev.startupName + idx} ev={ev} onClick={onSelect} />)
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default SearchHistory;
