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
  evaluatedAt?: string; // ISO timestamp when evaluation was performed (frontend-added)
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
  industry?: string;
  technologies?: string[];
  location?: string;
}

export interface AppState {
  phase: 'onboarding' | 'clarification' | 'evaluation';
  innovationTopic: string;
  clarificationQuestions: Question[];
  clarificationAnswers: Answer[];
  evaluations: EvaluationResult[];
  refinementRules: string[]; // User feedback loop
}

export interface HelpExample {
  input: string;
  result: string;
}

export interface HelpPayload {
  alwaysVisible?: boolean;
  displayAsTooltip?: boolean;
  infoToggleLabel?: string;
  examples?: HelpExample[];
  proTips?: string[];
  mandateEffect?: string;
  whyThisWorked?: string;
}

