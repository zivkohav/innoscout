import React, { useState, useEffect } from 'react';
import { Question, Answer } from '../types';
import { generateClarificationQuestions } from '../services/clarificationService';
import { Loader2, ArrowRight, CheckCircle, Target } from 'lucide-react';

interface Props {
  topic: string;
  onComplete: (answers: Answer[]) => void;
}

const ClarificationWizard: React.FC<Props> = ({ topic, onComplete }) => {
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    let mounted = true;
    const fetchQuestions = async () => {
      try {
        const generated = await generateClarificationQuestions(topic);
        if (mounted) {
          setQuestions(generated);
          setLoading(false);
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchQuestions();
    return () => { mounted = false; };
  }, [topic]);

  const handleNext = () => {
    if (currentStep < questions.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      // Submit
      const finalAnswers: Answer[] = questions.map(q => ({
        questionId: q.id,
        questionText: q.text,
        answerText: answers[q.id] || "No specific preference."
      }));
      onComplete(finalAnswers);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        handleNext();
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-slate-300">
        <Loader2 className="w-12 h-12 animate-spin mb-4 text-violet-500" />
        <p className="text-lg font-medium">Consulting the oracle to generate tailored criteria questions...</p>
        <p className="text-sm text-slate-500 mt-2">Topic: {topic}</p>
      </div>
    );
  }

  const currentQ = questions[currentStep];

  return (
    <div className="max-w-2xl mx-auto bg-slate-800 rounded-xl shadow-xl overflow-hidden border border-slate-700">
      <div className="bg-slate-900 px-6 py-4 border-b border-slate-700 flex justify-between items-center">
        <div className="flex items-center gap-2 text-violet-400">
          <Target className="w-5 h-5" />
          <h2 className="font-semibold text-lg">Calibration Phase</h2>
        </div>
        <span className="text-xs font-mono text-slate-500">
          Question {currentStep + 1} / {questions.length}
        </span>
      </div>
      
      <div className="p-8">
        <div className="mb-6">
            <span className={`inline-block px-2 py-1 rounded text-xs font-semibold mb-3
              ${currentQ.category === 'Strategic' ? 'bg-blue-900 text-blue-300' : 
                currentQ.category === 'Technical' ? 'bg-emerald-900 text-emerald-300' :
                currentQ.category === 'Market' ? 'bg-amber-900 text-amber-300' : 
                'bg-slate-700 text-slate-300'}`}>
              {currentQ.category}
            </span>
          <h3 className="text-xl font-medium text-slate-100 mb-2">{currentQ.text}</h3>
          <p className="text-slate-400 text-sm">Your answer will define the evaluation rules for future startups.</p>
        </div>

        <textarea
          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-4 text-slate-200 focus:ring-2 focus:ring-violet-500 focus:outline-none min-h-[120px]"
          placeholder="E.g., We are only looking for Series A+; Must have patents; No crypto..."
          value={answers[currentQ.id] || ''}
          onChange={(e) => setAnswers(prev => ({ ...prev, [currentQ.id]: e.target.value }))}
          onKeyDown={handleKeyDown}
          autoFocus
        />

        <div className="mt-8 flex justify-between items-center">
          <button 
            onClick={() => setAnswers(prev => ({ ...prev, [currentQ.id]: "Not applicable / No strict preference" }))}
            className="text-slate-500 hover:text-slate-300 text-sm"
          >
            Skip (No preference)
          </button>
          
          <button
            onClick={handleNext}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            {currentStep === questions.length - 1 ? 'Finish Setup' : 'Next Question'}
            {currentStep === questions.length - 1 ? <CheckCircle className="w-5 h-5"/> : <ArrowRight className="w-5 h-5" />}
          </button>
        </div>
      </div>
      
      {/* Progress Bar */}
      <div className="h-1 bg-slate-900 w-full">
        <div 
            className="h-full bg-violet-500 transition-all duration-300 ease-out"
            style={{ width: `${((currentStep + 1) / questions.length) * 100}%` }}
        />
      </div>
    </div>
  );
};

export default ClarificationWizard;