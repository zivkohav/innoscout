// api/gemini-search.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI } from "@google/genai";

type StartupCandidate = {
  id: string;
  name: string;
  url: string;
  description: string;
};

// Clean JSON if Gemini wraps it in ```json ... ```
const cleanJson = (text: string | undefined | null): string => {
  if (!text) return "";

  // Remove markdown code fences if present
  let cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();

  // Find the first opening brace and last closing brace
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  return cleaned.trim();
};


const getApiKey = (): string => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY is not set. Define it in .env.local and in Vercel project settings."
    );
  }
  return process.env.GEMINI_API_KEY;
};

const findStartupsWithGemini = async (query: string): Promise<StartupCandidate[]> => {
  const apiKey = getApiKey();
  const ai = new GoogleGenAI({
  apiKey,
  apiVersion: "v1", // force stable v1 instead of v1beta
});

  // Use a stable, widely-available model
 const model = "gemini-2.0-flash";

  const prompt = `
You are a startup research assistant. Your ONLY task is to identify real startups or technology companies that match the user query.

User Query: "${query}"

IMPORTANT RULES:
1. Treat the query primarily as a STARTUP NAME or BRAND (e.g., "Symbiobe", "Anthropic", "CropMind"), not as evaluation criteria.
2. First, try to find the company's OFFICIAL WEBSITE:
   - Look for domain names that closely match the startup name.
   - Examples:
     - "Symbiobe" → symbiobe.com, symbiobe.bio, symbiome.com, etc.
     - "CropMind" → cropmind.com, cropmind.ai, cropmind.io
3. If the official website is unclear:
   - Check named startup directories and databases such as:
     - Crunchbase
     - PitchBook
     - AngelList
     - YC, Techstars, accelerator portfolios
     - LinkedIn company pages
   - Use these sources to confirm that the company is real, and extract a short description.
4. Do NOT invent fictional startups. Only include companies that have a visible digital footprint (website, directory entry, or LinkedIn page).
5. Ignore any scoring criteria or evaluation context – you are ONLY doing name-based company lookup.

OUTPUT FORMAT (STRICT JSON):

{
  "startups": [
    {
      "name": "Company name",
      "url": "https://official-website-or-main-profile",
      "description": "One sentence describing their core technology or product."
    }
  ]
}

Constraints:
- Max 5 startups.
- If you are not reasonably confident that a company exists, do NOT include it.
- If nothing reasonable is found, return: { "startups": [] }.
`;


const result = await ai.models.generateContent({
  model,
  contents: prompt,
  generationConfig: {
    temperature: 0.2, // be conservative: less hallucination, more precise matching
  },
});

// Try to read text in a robust way
const rawText =
  (result as any).text ??
  (result as any).candidates?.[0]?.content?.parts?.[0]?.text ??
  "";

const jsonText = cleanJson(rawText || "{}");

let parsed: any;
try {
  parsed = JSON.parse(jsonText);
} catch (e) {
  console.error("Failed to parse JSON from Gemini:", jsonText);
  throw new Error("Gemini returned invalid JSON");
}

const list = Array.isArray(parsed.startups) ? parsed.startups : [];

return list.map((c: any, idx: number) => ({
  id: `gemini-${idx}`,
  name: c.name || "Unknown Name",
  url: c.url || "",
  description: c.description || "No description available.",
}));

};

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
