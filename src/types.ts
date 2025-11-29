export interface CriteriaScore {
  score: number; // 1-5
  reasoning: string;
}

export interface EvaluationResult {
  startupName: string;
  oneLineSummary: string;
  desirability: CriteriaScore;
  viability: CriteriaScore;
  feasibility: CriteriaScore;
  overallScore: number;
  redFlags: string[];
  isNoGo: boolean;
  sources?: string[]; // URLs from grounding
}

export interface Question {
  id: string;
  text: string;
  category: 'Strategic' | 'Technical' | 'Market' | 'Operational';
}

export interface Answer {
  questionId: string;
  questionText: string;
  answerText: string;
}

export interface StartupCandidate {
  id: string;
  name: string;
  url?: string;
  description: string;
}

export interface AppState {
  phase: 'onboarding' | 'clarification' | 'evaluation';
  innovationTopic: string;
  clarificationQuestions: Question[];
  clarificationAnswers: Answer[];
  evaluations: EvaluationResult[];
  refinementRules: string[]; // User feedback loop
}

