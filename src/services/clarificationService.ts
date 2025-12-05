// src/services/clarificationService.ts

import type { Question } from "../types";

// Simple placeholder version so the app builds and runs.
// You can later wire this to a backend API using Gemini if you want.

export const generateClarificationQuestions = async (
  topic: string
): Promise<Question[]> => {
  const trimmed = topic.trim() || "your innovation topic";

  return [
    {
      id: "1",
      text: `What specific problem within "${trimmed}" are you most focused on solving?`,
      category: "Strategic",
    },
    {
      id: "2",
      text: `What constraints or boundaries (regulatory, geographic, stage, etc.) apply to startups in "${trimmed}"?`,
      category: "Operational",
    },
    {
      id: "3",
      text: `What evidence of market traction or validation do you expect from startups in "${trimmed}"?`,
      category: "Market",
    },
  ];
};