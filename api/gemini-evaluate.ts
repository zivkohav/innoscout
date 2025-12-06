// api/gemini-evaluate.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI } from "@google/genai";

// ---- Types matching what the frontend sends ----

type StartupCandidate = {
  id: string;
  name: string;
  url?: string;
  description?: string;
};

type Answer = {
  questionText: string;
  answerText: string;
};

type EvaluationResult = {
  startupName: string;
  oneLineSummary: string;
  desirability: { score: number; reasoning: string };
  viability: { score: number; reasoning: string };
  feasibility: { score: number; reasoning: string };
  overallScore: number;
  redFlags: string[];
  isNoGo: boolean;
  sources?: string[];
};

type EvaluateRequestBody = {
  candidate: StartupCandidate;
  context: Answer[];
  refinementHistory: string[];
  fileData?: { mimeType: string; data: string };
};

// ---- Helpers ----

const cleanJson = (text: string | undefined | null): string => {
  if (!text) return "";

  // Strip markdown code fences if any
  let cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();

  // Keep only the main JSON object
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

// ---- Core evaluation logic ----

const evaluateWithGemini = async (
  candidate: StartupCandidate,
  context: Answer[],
  refinementHistory: string[],
  fileData?: { mimeType: string; data: string }
): Promise<EvaluationResult> => {
  const apiKey = getApiKey();
  const ai = new GoogleGenAI({
    apiKey,
    apiVersion: "v1",
  });

  const model = "gemini-2.0-flash";

  const contextString = context
    .map((a) => `Q: ${a.questionText}\nA: ${a.answerText}`)
    .join("\n---\n");

  const refinementString =
    refinementHistory.length > 0
      ? `\n\nCRITICAL REFINEMENT RULES FROM USER FEEDBACK (Override standard criteria if conflicting):\n${refinementHistory
          .map((r) => `- ${r}`)
          .join("\n")}`
      : "";

  const hasFile = !!fileData;

  const instructions = hasFile
    ? `
1. Analyze the PROVIDED DOCUMENT content to understand ${candidate.name}'s technology, model, and market.
2. Use external knowledge ONLY if the document is missing critical context.
3. The document is the primary source of truth for Feasibility/Viability.`
    : `
1. Research ${candidate.name} (products, news, team, traction) using your internal knowledge.
2. Analyze the startup based on the findings.`;

  const prompt = `
Role: Expert Open Innovation Manager.
Task: Research and Evaluate the startup "${candidate.name}" (URL: ${
    candidate.url || "Search for it"
  }).

Context Description: ${candidate.description || "No extra description provided."}

Definitions:
- Desirability: Does a market exist? Is the problem urgent? Do customers want this solution?
- Viability: Is the business model sound? Does it align with corporate strategy? Is it profitable/sustainable?
- Feasibility: Is the technology possible? Is the team capable? Is the IP defensible?

User Constraints (The "Lens"):
${contextString}

${refinementString}

Instructions:
${instructions}

4. Analyze the startup against the Context and Definitions.
5. Assign a score (1-5) for each criteria (Desirability, Viability, Feasibility).
6. Identify RED FLAGS based on the User Constraints (e.g., TRL too low, wrong sector).
7. If there is a critical red flag (No-Go), set isNoGo to true.

Output STRICT JSON with this structure:
{
  "startupName": "${candidate.name}",
  "oneLineSummary": "...",
  "desirability": { "score": number, "reasoning": "..." },
  "viability": { "score": number, "reasoning": "..." },
  "feasibility": { "score": number, "reasoning": "..." },
  "overallScore": number,
  "redFlags": ["flag1", ...],
  "isNoGo": boolean
}
`;

  const parts: any[] = [{ text: prompt }];
  if (fileData) {
    parts.push({
      inlineData: { mimeType: fileData.mimeType, data: fileData.data },
    });
  }

// ...existing code...
 const result = await (ai.models as any).generateContent({
   model,
   contents: { parts },
   generationConfig: {
     temperature: 0.4,
   },
 });
 // ...existing code...


  const rawText =
    (result as any).text ??
    (result as any).candidates?.[0]?.content?.parts?.[0]?.text ??
    "";

  const jsonText = cleanJson(rawText || "{}");

  let evaluation = JSON.parse(jsonText) as EvaluationResult;

  // Attach simple "sources" info if any grounding metadata exists (best-effort)
  const chunks =
    (result as any).candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const sources: string[] = [];
  chunks.forEach((chunk: any) => {
    if (chunk.web?.uri) sources.push(chunk.web.uri);
  });
  if (fileData) sources.unshift("Uploaded Document");

  evaluation.sources = Array.from(new Set(sources));

  return evaluation;
};

// ---- API handler ----

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = req.body as EvaluateRequestBody;

    if (!body?.candidate) {
      return res.status(400).json({ error: "Missing 'candidate' in request body" });
    }

    const candidate = body.candidate;
    const context = body.context || [];
    const refinementHistory = body.refinementHistory || [];
    const fileData = body.fileData;

    console.log("[/api/gemini-evaluate] Candidate:", candidate.name);

    const evaluation = await evaluateWithGemini(
      candidate,
      context,
      refinementHistory,
      fileData
    );

    return res.status(200).json(evaluation);
  } catch (error: any) {
    console.error("Error in /api/gemini-evaluate:", error);
    return res
      .status(500)
      .json({ error: error?.message || "Internal server error" });
  }
}
