// src/services/geminiService.ts
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Question, EvaluationResult, Answer, StartupCandidate } from "../types";

// ------------------ JSON CLEANUP HELPER ------------------

const cleanJson = (text: string) => {
  if (!text) return "";
  // Remove markdown code blocks (case insensitive)
  let cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();

  // Find the start and end of the JSON structure
  const firstOpenBrace = cleaned.indexOf("{");
  const firstOpenBracket = cleaned.indexOf("[");
  const lastCloseBrace = cleaned.lastIndexOf("}");
  const lastCloseBracket = cleaned.lastIndexOf("]");

  let start = -1;
  let end = -1;

  // Determine if we are looking for an object or an array based on which comes first
  if (
    firstOpenBrace !== -1 &&
    (firstOpenBracket === -1 || firstOpenBrace < firstOpenBracket)
  ) {
    start = firstOpenBrace;
    end = lastCloseBrace;
  } else if (firstOpenBracket !== -1) {
    start = firstOpenBracket;
    end = lastCloseBracket;
  }

  if (start !== -1 && end !== -1 && end >= start) {
    cleaned = cleaned.substring(start, end + 1);
  }

  return cleaned;
};

// ------------------ API KEY + AUTH HELPERS ------------------

const getApiKey = (): string => {
  if (typeof process === "undefined" || !process.env?.GEMINI_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY is not set. Define it in your .env.local and in Vercel project settings."
    );
  }
  return process.env.GEMINI_API_KEY;
};

const isAuthError = (error: any) => {
  const msg = (error?.message || JSON.stringify(error)).toLowerCase();
  return (
    error?.status === 401 ||
    error?.status === 403 ||
    msg.includes("api key") ||
    msg.includes("permission_denied") ||
    msg.includes("requested entity was not found") ||
    msg.includes("unauthorized")
  );
};

const executeGenAI = async <T>(
  operation: (ai: GoogleGenAI) => Promise<T>
): Promise<T> => {
  const apiKey = getApiKey();
  console.log("GEMINI_API_KEY present:", !!apiKey);

  const ai = new GoogleGenAI({ apiKey });

  try {
    return await operation(ai);
  } catch (error: any) {
    console.error("Gemini API call failed:", error);
    throw error;
  }
};

// ------------------ PUBLIC FUNCTIONS ------------------

export const generateClarificationQuestions = async (
  topic: string
): Promise<Question[]> => {
  const model = "gemini-2.5-flash";
  const prompt = `
    You are an expert Open Innovation Consultant. 
    A client is looking for startups in the field of: "${topic}".
    To effectively evaluate potential targets, you need to calibrate your scoring criteria.
    
    Generate exactly 3 high-impact clarification questions that will help define the core boundaries for:
    1. Viability (Business fit, strategic alignment)
    2. Desirability (Market need, customer pain points)
    3. Feasibility (Technical maturity, IP, resources)
    
    Focus on the most critical deal-breakers or success factors for this specific topic to establish a baseline.

    Return the response as a JSON array of objects with keys: "id" (string), "text" (string), "category" (Strategic, Technical, Market, Operational).
  `;

  const responseSchema: Schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING },
        text: { type: Type.STRING },
        category: {
          type: Type.STRING,
          enum: ["Strategic", "Technical", "Market", "Operational"],
        },
      },
      required: ["id", "text", "category"],
    },
  };

  try {
    const result = await executeGenAI(async (ai) => {
      return await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema,
          temperature: 0.7,
        },
      });
    });

    const questions = JSON.parse(result.text || "[]") as Question[];
    return questions.slice(0, 3);
  } catch (error) {
    console.error("Error generating questions:", error);

    return [
      {
        id: "1",
        text: "What is the minimum Technology Readiness Level (TRL) required?",
        category: "Technical",
      },
      {
        id: "2",
        text: "Are there any specific business models you are avoiding?",
        category: "Strategic",
      },
      {
        id: "3",
        text: "What is the primary problem this innovation must solve?",
        category: "Market",
      },
    ];
  }
};

export const findStartups = async (
  query: string
): Promise<StartupCandidate[]> => {
  const model = "gemini-2.5-flash";

  const basePrompt = `
    User Query: "${query}"

    Task: Search for startups or technology companies that match this name or description.
    
    Instructions:
    1. **Disambiguate**: If the query is a specific name (e.g., "Neo"), look for distinct companies with that name or similar variations (e.g., "Neo Cyber", "Neo Materials").
    2. **Digital Footprint**: For each company, prioritize finding their **Official Website**. If not found, find their **LinkedIn Company Page**.
    3. **Description**: Provide a brief 1-sentence description of their core technology.

    Retrieve up to 5 distinct, real candidates.
  `;

  const parseCandidates = (candidates: any) => {
    let list: any[] = [];
    if (Array.isArray(candidates)) {
      list = candidates;
    } else if (typeof candidates === "object" && candidates !== null) {
      if (Array.isArray(candidates.companies)) list = candidates.companies;
      else if (Array.isArray(candidates.candidates)) list = candidates.candidates;
      else if (Array.isArray(candidates.results)) list = candidates.results;
      else {
        const arrayVal = Object.values(candidates).find((v) => Array.isArray(v));
        if (arrayVal) list = arrayVal as any[];
      }
    }
    return list.map((c: any, idx: number) => ({
      id: `candidate-${idx}`,
      name: c.name || "Unknown Name",
      url: c.url || "",
      description: c.description || "No description available.",
    }));
  };

  try {
    const result = await executeGenAI(async (ai) => {
      return await ai.models.generateContent({
        model,
        contents:
          basePrompt +
          "\nOutput strictly as a JSON object with a 'companies' key containing an array of objects (keys: name, url, description).",
        config: {
          tools: [{ googleSearch: {} }],
          systemInstruction: "You are a helpful assistant. Output valid JSON.",
        },
      });
    });

    const jsonText = cleanJson(result.text || "{}");
    if (!jsonText || jsonText === "{}") throw new Error("Empty search result");

    return parseCandidates(JSON.parse(jsonText));
  } catch (searchError: any) {
    if (isAuthError(searchError)) {
      console.error("Auth error in findStartups. Check GEMINI_API_KEY.", searchError);
      throw searchError;
    }

    console.warn(
      "Search tool failed or not available. Falling back to internal knowledge.",
      searchError
    );

    try {
      const fallbackResult = await executeGenAI(async (ai) => {
        return await ai.models.generateContent({
          model,
          contents:
            basePrompt +
            "\n\nImportant: Search is unavailable. Use your internal knowledge. Output strictly as a JSON object with a 'companies' key containing an array of objects (keys: name, url, description).",
          config: {
            responseMimeType: "application/json",
            temperature: 0.7,
          },
        });
      });

      const jsonText = cleanJson(fallbackResult.text || "{}");
      return parseCandidates(JSON.parse(jsonText));
    } catch (fallbackError) {
      console.error("Critical error finding startups:", fallbackError);
      throw fallbackError;
    }
  }
};

export const evaluateStartup = async (
  candidate: StartupCandidate,
  context: Answer[],
  refinementHistory: string[],
  fileData?: { mimeType: string; data: string }
): Promise<EvaluationResult> => {
  const model = "gemini-2.5-flash";

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

  let instructions = "";
  if (hasFile) {
    instructions = `
    1. Analyze the PROVIDED DOCUMENT content to understand ${candidate.name}'s technology, model, and market.
    2. Supplement with external knowledge ONLY if the document is missing critical context.
    3. The document is the primary source of truth for Feasibility/Viability.
    `;
  } else {
    instructions = `
    1. Research ${candidate.name} (products, news, team, traction) using available tools or internal knowledge.
    2. Analyze the startup based on the findings.
    `;
  }

  const promptText = `
    Role: Expert Open Innovation Manager.
    Task: Research and Evaluate the startup "${candidate.name}" (URL: ${
      candidate.url || "Search for it"
    }).
    
    Context Description: ${candidate.description}

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

    Output STRICT JSON.
    Structure:
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

  const processResponse = (result: any) => {
    const jsonText = cleanJson(result.text || "{}");
    const evaluation = JSON.parse(jsonText) as EvaluationResult;

    const chunks = result.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources: string[] = [];
    chunks.forEach((chunk: any) => {
      if (chunk.web?.uri) sources.push(chunk.web.uri);
    });

    if (hasFile) sources.unshift("Uploaded Document");
    evaluation.sources = Array.from(new Set(sources));
    return evaluation;
  };

  try {
    const parts: any[] = [{ text: promptText }];
    if (fileData) {
      parts.push({
        inlineData: { mimeType: fileData.mimeType, data: fileData.data },
      });
    }

    const result = await executeGenAI(async (ai) => {
      return await ai.models.generateContent({
        model,
        contents: { parts },
        config: {
          tools: [{ googleSearch: {} }],
          systemInstruction: "You are an analytical engine. Output JSON only.",
        },
      });
    });

    return processResponse(result);
  } catch (error: any) {
    if (isAuthError(error)) {
      console.error("Auth error in evaluateStartup. Check GEMINI_API_KEY.", error);
      throw error;
    }

    console.warn(
      "Evaluation with search failed. Falling back to internal knowledge.",
      error
    );

    try {
      const parts: any[] = [
        {
          text:
            promptText +
            "\n\nProvide the evaluation based on internal knowledge only.",
        },
      ];
      if (fileData) {
        parts.push({
          inlineData: {
            mimeType: fileData.mimeType,
            data: fileData.data,
          },
        });
      }

      const result = await executeGenAI(async (ai) => {
        return await ai.models.generateContent({
          model,
          contents: { parts },
          config: {
            responseMimeType: "application/json",
            temperature: 0.5,
          },
        });
      });

      return processResponse(result);
    } catch (fatalError: any) {
      console.error("Evaluation failed completely", fatalError);
      throw fatalError;
    }
  }
};

export const formalizeRefinementRule = async (
  rawInput: string
): Promise<string> => {
  const model = "gemini-2.5-flash";
  const prompt = `
    Transform the following user feedback into a specific, actionable evaluation rule.
    User Input: "${rawInput}"
    Output only the rule string.
  `;

  try {
    const result = await executeGenAI(async (ai) => {
      return await ai.models.generateContent({ model, contents: prompt });
    });
    return result.text?.trim() || rawInput;
  } catch (error) {
    console.error("Formalization failed:", error);
    return rawInput;
  }
};