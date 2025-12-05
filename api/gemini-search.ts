// api/gemini-search.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI } from "@google/genai";

// Type for what we return to the frontend
type StartupCandidate = {
  id: string;
  name: string;
  url: string;
  description: string;
};

// Simple cleaner for JSON that might be wrapped in ```json ... ```
const cleanJson = (text: string | undefined | null): string => {
  if (!text) return "";
  let cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  return cleaned;
};

// Get API key from environment (server-only)
const getApiKey = (): string => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY is not set. Define it in .env.local (for local dev) and in Vercel project settings."
    );
  }
  return process.env.GEMINI_API_KEY;
};

// Call Gemini to find startups
const findStartupsWithGemini = async (query: string): Promise<StartupCandidate[]> => {
  const apiKey = getApiKey();
  const ai = new GoogleGenAI({ apiKey });
  const model = "gemini-2.5-flash";

  const prompt = `
User Query: "${query}"

Task: Search for startups or technology companies that match this name or description.

Instructions:
1. If the query is a specific name (e.g., "Neo"), look for distinct companies with that name or similar variations.
2. For each company, prioritize finding their Official Website. If not found, use their LinkedIn Company Page.
3. Provide a brief 1-sentence description of their core technology.

Output strictly as JSON:
{
  "startups": [
    { "name": "...", "url": "...", "description": "..." },
    ...
  ]
}
`;

  const result = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      temperature: 0.3,
    },
  });

  const jsonText = cleanJson((result as any).text || "{}");
  const parsed = JSON.parse(jsonText) as { startups?: any[] };

  const list = Array.isArray(parsed.startups) ? parsed.startups : [];

  // Normalize into StartupCandidate[]
  return list.map((c, idx) => ({
    id: `gemini-${idx}`,
    name: c.name || "Unknown Name",
    url: c.url || "",
    description: c.description || "No description available.",
  }));
};

// API handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { query } = req.body as { query?: string };

    if (!query || !query.trim()) {
      return res.status(400).json({ error: "Missing 'query' in request body" });
    }

    console.log("[/api/gemini-search] Query:", query);

    const startups = await findStartupsWithGemini(query);

    return res.status(200).json({ startups });
  } catch (error: any) {
    console.error("Error in /api/gemini-search:", error);
    return res
      .status(500)
      .json({ error: error?.message || "Internal server error" });
  }
}
