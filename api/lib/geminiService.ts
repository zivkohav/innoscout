// api/lib/geminiService.ts

// Minimal version just to prove the API route works.
// No Gemini, no env vars, no external modules.

export type StartupCandidate = {
  id: string;
  name: string;
  url: string;
  description: string;
};

export const findStartups = async (query: string): Promise<StartupCandidate[]> => {
  // Return some fake startups so we can see it working end-to-end.
  return [
    {
      id: "dummy-1",
      name: `${query} AI`,
      url: "https://example.com/ai",
      description: `Dummy startup 1 for query "${query}".`
    },
    {
      id: "dummy-2",
      name: `${query} Labs`,
      url: "https://example.com/labs",
      description: `Dummy startup 2 for query "${query}".`
    }
  ];
};