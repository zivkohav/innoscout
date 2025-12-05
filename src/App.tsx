import React, { useState, useRef, useEffect } from 'react';
import { Answer, EvaluationResult, AppState, StartupCandidate } from './types';
import ClarificationWizard from './components/ClarificationWizard';
import EvaluationCard from './components/EvaluationCard';
import StartupSelector from './components/StartupSelector';
import CriteriaPanel from './components/CriteriaPanel';
import { Search, Sparkles, Database, Plus, Zap, Loader2, Paperclip, X, FileText, RotateCcw } from 'lucide-react';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    phase: 'onboarding',
    innovationTopic: '',
    clarificationQuestions: [],
    clarificationAnswers: [],
    evaluations: [],
    refinementRules: []
  });

  const [searchInput, setSearchInput] = useState('');
  const [searchStatus, setSearchStatus] = useState<'idle' | 'searching' | 'selecting' | 'evaluating'>('idle');
  const [candidates, setCandidates] = useState<StartupCandidate[]>([]);

  // File Upload State
  const [selectedFile, setSelectedFile] = useState<{ name: string; data: string; mimeType: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- PERSISTENCE LOGIC ---

  // Load brief on mount
  useEffect(() => {
    const savedBrief = localStorage.getItem('innoscout_brief');
    if (savedBrief) {
      try {
        const parsed = JSON.parse(savedBrief);
        if (parsed.innovationTopic && parsed.clarificationAnswers?.length > 0) {
          setState(prev => ({
            ...prev,
            phase: 'evaluation',
            innovationTopic: parsed.innovationTopic,
            clarificationAnswers: parsed.clarificationAnswers,
            refinementRules: parsed.refinementRules || []
          }));
        }
      } catch (e) {
        console.error('Failed to load saved brief', e);
      }
    }
  }, []);

  // Save brief on change
  useEffect(() => {
    if (state.phase === 'evaluation') {
      const brief = {
        innovationTopic: state.innovationTopic,
        clarificationAnswers: state.clarificationAnswers,
        refinementRules: state.refinementRules
      };
      localStorage.setItem('innoscout_brief', JSON.stringify(brief));
    }
  }, [state.innovationTopic, state.clarificationAnswers, state.refinementRules, state.phase]);

  const handleResetMandate = () => {
    if (window.confirm('Start a new Innovation Mandate? This will clear your current criteria brief and saved rules.')) {
      localStorage.removeItem('innoscout_brief');
      setState({
        phase: 'onboarding',
        innovationTopic: '',
        clarificationQuestions: [],
        clarificationAnswers: [],
        evaluations: [],
        refinementRules: []
      });
    }
  };

  // --- END PERSISTENCE LOGIC ---

  const startClarification = () => {
    if (!state.innovationTopic.trim()) return;
    setState(prev => ({ ...prev, phase: 'clarification' }));
  };

  const handleClarificationComplete = (answers: Answer[]) => {
    setState(prev => ({
      ...prev,
      clarificationAnswers: answers,
      phase: 'evaluation'
    }));
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64String = event.target?.result as string;
      const base64Data = base64String.split(',')[1];
      setSelectedFile({
        name: file.name,
        mimeType: file.type,
        data: base64Data
      });
      if (!searchInput) {
        setSearchInput(file.name.split('.')[0]);
      }
    };
    reader.readAsDataURL(file);
  };

  const clearFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAction = async () => {
    if (!searchInput.trim()) return;

    // --- CASE 1: Evaluate from uploaded file directly ---
    if (selectedFile) {
      setSearchStatus('evaluating');

      const manualCandidate: StartupCandidate = {
        id: 'manual-upload',
        name: searchInput,
        description: `Analysis based on uploaded document: ${selectedFile.name}`,
        url: ''
      };

      try {
        const result = await evaluateStartup(
          manualCandidate,
          state.clarificationAnswers,
          state.refinementRules,
          { mimeType: selectedFile.mimeType, data: selectedFile.data }
        );

        setState(prev => ({
          ...prev,
          evaluations: [result, ...prev.evaluations]
        }));

        setSearchInput('');
        clearFile();
        setSearchStatus('idle');
      } catch (error: any) {
        console.error(error);
        alert(`Evaluation Failed: ${error.message}`);
        setSearchStatus('idle');
      }
    } else {
      // --- CASE 2: Search for startup by name using API route ---
      setSearchStatus('searching');

      try {
        const response = await fetch('/api/gemini-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: searchInput })   // ⬅️ use searchInput
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error || 'Request failed');
        }

        const data = await response.json();
        const startups: StartupCandidate[] = data.startups || [];

        if (startups.length > 0) {
          setCandidates(startups);
          setSearchStatus('selecting');
        } else {
          alert('No startups found. Please try a different query.');
          setSearchStatus('idle');
        }
      } catch (error: any) {
        console.error(error);
        alert(`Search Failed: ${error.message}`);
        setSearchStatus('idle');
      }
    }
  };

  const handleSelectStartup = async (candidate: StartupCandidate) => {
    setSearchStatus('evaluating');
    try {
      const result = await evaluateStartup(
        candidate,
        state.clarificationAnswers,
        state.refinementRules
      );
      setState(prev => ({
        ...prev,
        evaluations: [result, ...prev.evaluations]
      }));
      setSearchInput('');
      setSearchStatus('idle');
      setCandidates([]);
    } catch (error: any) {
      console.error(error);
      alert(`Evaluation Failed: ${error.message}`);
      setSearchStatus('selecting');
    }
  };

  const handleRefine = (feedback: string) => {
    setState(prev => ({
      ...prev,
      refinementRules: [...prev.refinementRules, feedback]
    }));
  };

  return (
    <div className="min-h-screen pb-12">
      {/* Header */}
      <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-900/20">
              <Zap className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">InnoScout</h1>
              <p className="text-xs text-slate-400 font-medium tracking-wide uppercase">Innovation Evaluation Engine</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {state.phase === 'evaluation' && (
              <div className="hidden md:flex items-center gap-4 text-sm text-slate-400">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded-full border border-slate-700">
                  <Search className="w-3 h-3" />
                  <span className="max-w-[150px] truncate">{state.innovationTopic}</span>
                </div>

                <button
                  onClick={handleResetMandate}
                  className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-rose-900/30 hover:text-rose-400 rounded-full border border-slate-700 hover:border-rose-800 transition-colors"
                  title="Start New Mandate"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>New Mandate</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Criteria Panel (Evaluation Phase Only) */}
      {state.phase === 'evaluation' && (
        <CriteriaPanel
          topic={state.innovationTopic}
          answers={state.clarificationAnswers}
          refinementRules={state.refinementRules}
        />
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* PHASE 1: Onboarding */}
        {state.phase === 'onboarding' && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center max-w-2xl mx-auto">
            <div className="bg-violet-500/10 p-4 rounded-full mb-6">
              <Sparkles className="w-12 h-12 text-violet-400" />
            </div>
            <h2 className="text-4xl font-extrabold text-white mb-4 tracking-tight">What are you scouting for?</h2>
            <p className="text-lg text-slate-400 mb-8">
              Describe your innovation mandate. I will generate 3 targeted calibration questions to customize the evaluation engine for your specific needs.
            </p>

            <div className="w-full relative">
              <textarea
                value={state.innovationTopic}
                onChange={(e) => setState(prev => ({ ...prev, innovationTopic: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    startClarification();
                  }
                }}
                placeholder="e.g., 'Carbon capture technologies for industrial manufacturing. We are specifically looking for Series A startups with proven pilots in Europe...'"
                className="w-full p-4 pl-6 pr-16 text-lg bg-slate-800 border-2 border-slate-700 rounded-2xl focus:border-violet-500 focus:ring-4 focus:ring-violet-500/20 text-white placeholder-slate-500 transition-all outline-none resize-none min-h-[140px]"
              />
              <button
                onClick={startClarification}
                className="absolute right-3 bottom-3 bg-violet-600 hover:bg-violet-500 text-white p-3 rounded-xl transition-colors shadow-lg"
                disabled={!state.innovationTopic}
              >
                <ArrowRightIcon />
              </button>
            </div>

            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 text-left w-full">
              <FeatureBox title="Contextual" desc="Adapts criteria to your specific strategic goals." />
              <FeatureBox title="Persistent" desc="Maintains your mandate brief across sessions." />
              <FeatureBox title="Adaptive" desc="Learns from your feedback to improve scoring." />
            </div>
          </div>
        )}

        {/* PHASE 2: Clarification */}
        {state.phase === 'clarification' && (
          <ClarificationWizard
            topic={state.innovationTopic}
            onComplete={handleClarificationComplete}
          />
        )}

        {/* PHASE 3: Evaluation Dashboard */}
        {state.phase === 'evaluation' && (
          <div className="space-y-8">
            {/* Input Section */}
            <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 shadow-xl relative overflow-hidden">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Plus className="w-5 h-5 text-violet-400" />
                Evaluate New Technology
              </h3>

              {searchStatus === 'idle' && (
                <div className="relative">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAction()}
                        placeholder={selectedFile ? "Enter startup name for this document..." : "Search for a startup (e.g. 'Anthropic')..."}
                        className={`w-full bg-slate-900 border ${
                          selectedFile ? 'border-violet-500/50' : 'border-slate-700'
                        } rounded-xl p-4 pl-12 pr-12 text-slate-200 focus:ring-2 focus:ring-violet-500 focus:outline-none transition-all`}
                      />
                      {selectedFile ? (
                        <FileText className="absolute left-4 top-4 w-5 h-5 text-violet-400" />
                      ) : (
                        <Search className="absolute left-4 top-4 w-5 h-5 text-slate-500" />
                      )}

                      {/* File Upload Button */}
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute right-3 top-3 p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                        title="Upload Pitch Deck or Whitepaper"
                      >
                        <Paperclip className="w-5 h-5" />
                      </button>
                      <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept=".pdf,.txt,.md,.png,.jpg,.jpeg"
                        onChange={handleFileSelect}
                      />
                    </div>

                    <button
                      onClick={handleAction}
                      className={`px-6 rounded-lg text-sm font-medium transition-colors whitespace-nowrap
                        ${selectedFile
                          ? 'bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-900/20'
                          : 'bg-slate-700 hover:bg-slate-600 text-white'}`}
                    >
                      {selectedFile ? 'Evaluate File' : 'Find Startup'}
                    </button>
                  </div>

                  {/* File Chip */}
                  {selectedFile && (
                    <div className="absolute top-full left-0 mt-2 flex items-center gap-2 bg-violet-900/20 border border-violet-500/30 text-violet-200 text-xs px-2 py-1 rounded animate-in fade-in slide-in-from-top-1">
                      <Paperclip className="w-3 h-3" />
                      <span className="truncate max-w-[200px]">{selectedFile.name}</span>
                      <button onClick={clearFile} className="hover:text-white ml-1">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {searchStatus === 'searching' && (
                <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                  <Loader2 className="w-8 h-8 animate-spin text-violet-500 mb-2" />
                  <p>Scouring the web for candidates...</p>
                </div>
              )}

              {searchStatus === 'selecting' && (
                <StartupSelector
                  candidates={candidates}
                  onSelect={handleSelectStartup}
                  onCancel={() => {
                    setSearchStatus('idle');
                    setCandidates([]);
                  }}
                />
              )}

              {searchStatus === 'evaluating' && (
                <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                  <div className="relative">
                    <div className="absolute inset-0 bg-violet-500 blur-xl opacity-20 animate-pulse"></div>
                    <Sparkles className="relative w-8 h-8 text-violet-400 animate-bounce mb-2" />
                  </div>
                  <p className="font-medium text-slate-200">
                    {selectedFile ? 'Analyzing document & performing background checks...' : 'Analyzing startup potential...'}
                  </p>
                  <p className="text-sm mt-1">Applying your custom criteria & searching for red flags</p>
                </div>
              )}
            </div>

            {/* Results Grid */}
            <div>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">Evaluated Startups ({state.evaluations.length})</h3>
                {state.evaluations.length > 0 && (
                  <span className="text-sm text-slate-400">Sorted by recent</span>
                )}
              </div>

              {state.evaluations.length === 0 ? (
                <div className="text-center py-20 border-2 border-dashed border-slate-800 rounded-2xl">
                  <Database className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                  <p className="text-slate-500 text-lg">No evaluations yet.</p>
                  <p className="text-slate-600">Search for a startup or upload a deck to begin scouting.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {state.evaluations.map((evaluation, idx) => (
                    <EvaluationCard
                      key={idx}
                      evaluation={evaluation}
                      onRefine={handleRefine}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

const FeatureBox = ({ title, desc }: { title: string; desc: string }) => (
  <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
    <h4 className="font-bold text-violet-400 mb-1">{title}</h4>
    <p className="text-slate-400 text-sm">{desc}</p>
  </div>
);

const ArrowRightIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
);

export default App;