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
  mandateId?: string; // Link evaluation to a specific mandate
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

export interface Mandate {
  id: string; // Unique ID (UUID or timestamp-based)
  name: string; // User-provided or AI-suggested name
  innovationTopic: string;
  clarificationAnswers: Answer[];
  refinementRules: string[];
  market?: string;
  stage?: string;
  region?: string;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

export interface AppState {
  phase: 'onboarding' | 'clarification' | 'evaluation';
  mandates: Mandate[]; // All saved mandates
  activeMandateId: string | null; // Currently active mandate
  clarificationQuestions: Question[]; // Populated during clarification
  evaluations: EvaluationResult[]; // All evaluations across all mandates
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

