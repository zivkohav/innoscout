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
  let cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  return cleaned;
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
User Query: "${query}"

Task: Suggest up to 5 real startups or technology companies that best match this name or description.

Instructions:
- For each company, include:
  - "name": company or startup name
  - "url": official website URL (or main LinkedIn page if website unavailable)
  - "description": a 1-sentence summary of their core technology or product.
- Only include real companies (no fictional examples).

Output strictly as JSON in this shape:
{
  "startups": [
    { "name": "...", "url": "...", "description": "..." }
  ]
}
`;

const result = await ai.models.generateContent({
  model,
  // simplest, doc-friendly shape: just a string
  contents: prompt,
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
