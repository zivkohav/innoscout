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

GOAL:
Return a SHORTLIST of real companies so the user can choose the correct one,
especially when there are multiple startups with similar or confusing names.

RULES:

1. TREAT THE QUERY AS A NAME
   - Assume the query is primarily a startup / company / product NAME (e.g., "Symbiobe", "CropMind", "Neo", "Lumen").
   - Do NOT treat it as evaluation criteria or a long description.

2. FIND MULTIPLE CANDIDATES (VERY IMPORTANT)
   - Always try to return between 2 and 5 candidates when possible.
   - Include:
     - The best exact match (if one exists).
     - Close alternatives:
       - Slight spelling variations.
       - Different suffixes (Labs, AI, Systems, Technologies, Biosciences, etc.).
       - Different domains (.com, .ai, .io, .bio, etc.).
   - Only return 1 startup **if you are very confident** there is only one real company with that name.

3. DIGITAL FOOTPRINT
   - For each candidate, look for:
     - Official WEBSITE whose domain closely matches the name
       - e.g., "Symbiobe" → symbiobe.com, symbiobe.bio, symbiome.com
       - e.g., "CropMind" → cropmind.com, cropmind.ai, cropmind.io
     - OR, if the website is unclear:
       - Crunchbase company profile
       - PitchBook profile
       - AngelList
       - Startup directories / accelerator portfolios
       - LinkedIn company page
   - Only include companies that have at least one clear digital footprint.

4. DO NOT INVENT
   - Do NOT hallucinate fictional startups.
   - If you are not reasonably sure a company exists, do not include it.

5. OUTPUT FORMAT (STRICT JSON)

Output ONLY JSON in this shape:

{
  "startups": [
    {
      "name": "Company name",
      "url": "https://official-website-or-main-profile",
      "description": "One sentence describing their core technology or product."
    }
  ]
}

EXAMPLES (STRUCTURE ONLY, NOT CONTENT):

{
  "startups": [
    {
      "name": "Symbiobe",
      "url": "https://symbiobe.com/",
      "description": "..."
    },
    {
      "name": "Symbiome",
      "url": "https://symbiome.com/",
      "description": "..."
    },
    {
      "name": "SymBio Labs",
      "url": "https://symbiolabs.com/",
      "description": "..."
    }
  ]
}

CONSTRAINTS:
- Max 5 startups.
- Prefer: [1 best exact match + 1–4 close alternatives].
- If nothing reasonable is found, return: { "startups": [] }.
`;



const result = await ai.models.generateContent({
  model,
  contents: prompt,
  generationConfig: {
    temperature: 0.3, // be conservative: less hallucination, more precise matching
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
