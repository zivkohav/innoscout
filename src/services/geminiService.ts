import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Question, EvaluationResult, Answer, StartupCandidate } from "../types";

// VITE FIX: Use import.meta.env instead of process.env
const apiKey = import.meta.env.VITE_API_KEY || "";
const ai = new GoogleGenAI({ apiKey });

// Helper to sanitize JSON strings if the model returns markdown code blocks
const cleanJson = (text: string) => {
  if (!text) return "";
  // Remove markdown code blocks (case insensitive)
  let cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  
  // Find the start and end of the JSON structure
  const firstOpenBrace = cleaned.indexOf('{');
  const firstOpenBracket = cleaned.indexOf('[');
  const lastCloseBrace = cleaned.lastIndexOf('}');
  const lastCloseBracket = cleaned.lastIndexOf(']');
  
  let start = -1;
  let end = -1;

  // Determine if we are looking for an object or an array based on which comes first
  if (firstOpenBrace !== -1 && firstOpenBracket !== -1) {
      if (firstOpenBrace < firstOpenBracket) {
          start = firstOpenBrace;
          end = lastCloseBrace;
      } else {
          start = firstOpenBracket;
          end = lastCloseBracket;
      }
  } else if (firstOpenBrace !== -1) {
      start = firstOpenBrace;
      end = lastCloseBrace;
  } else if (firstOpenBracket !== -1) {
      start = firstOpenBracket;
      end = lastCloseBracket;
  }

  if (start !== -1 && end !== -1 && end > start) {
      cleaned = cleaned.substring(start, end + 1);
  }
  
  return cleaned;
};

export const generateClarificationQuestions = async (topic: string): Promise<Question[]> => {
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
        category: { type: Type.STRING, enum: ['Strategic', 'Technical', 'Market', 'Operational'] }
      },
      required: ['id', 'text', 'category']
    }
  };

  try {
    const result = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.7
      }
    });

    const questions = JSON.parse(result.text || "[]") as Question[];
    return questions.slice(0, 3);
  } catch (error) {
    console.error("Error generating questions:", error);
    return [
      { id: '1', text: 'What is the minimum Technology Readiness Level (TRL) required?', category: 'Technical' },
      { id: '2', text: 'Are there any specific business models you are avoiding?', category: 'Strategic' },
      { id: '3', text: 'What is the primary problem this innovation must solve?', category: 'Market' },
    ];
  }
};

export const findStartups = async (query: string): Promise<StartupCandidate[]> => {
  const model = "gemini-2.5-flash";
  
  // Base prompt used for both strategies
  const basePrompt = `
    User Query: "${query}"

    Task: Search for startups or technology companies that match this name or description.
    
    Instructions:
    1. **Disambiguate**: If the query is a specific name (e.g., "Neo"), look for distinct companies with that name or similar variations (e.g., "Neo Cyber", "Neo Materials").
    2. **Digital Footprint**: For each company, prioritize finding their **Official Website**. If not found, find their **LinkedIn Company Page**.
    3. **Description**: Provide a brief 1-sentence description of their core technology.

    Retrieve up to 5 distinct, real candidates.
  `;

  // Fallback Schema
  const candidateSchema: Schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING },
        url: { type: Type.STRING },
        description: { type: Type.STRING }
      },
      required: ["name", "description"]
    }
  };

  // Helper to parse response
  const parseCandidates = (candidates: any) => {
      // Handle case where model returns { candidates: [...] }
      if (!Array.isArray(candidates) && typeof candidates === 'object') {
          const key = Object.keys(candidates).find(k => Array.isArray(candidates[k]));
          if (key) {
               candidates = candidates[key];
          }
      }

      if (!Array.isArray(candidates)) return [];

      return candidates.map((c: any, idx: number) => ({
        id: `candidate-${idx}`,
        name: c.name,
        url: c.url,
        description: c.description
      }));
  };

  // --- ATTEMPT 1: Search Enabled ---
  try {
    const result = await ai.models.generateContent({
      model,
      contents: basePrompt + "\nOutput strictly as a JSON array of objects with keys: name, url, description.",
      config: {
        tools: [{ googleSearch: {} }],
        // Moving system instruction to prompt text often improves stability in some environments
        systemInstruction: "You are a search assistant. Return ONLY raw JSON arrays. No markdown." 
      }
    });

    const jsonText = cleanJson(result.text || "[]");
    if (!jsonText || jsonText === "[]") throw new Error("Empty search result");
    
    const candidates = JSON.parse(jsonText);
    const parsed = parseCandidates(candidates);
    if (parsed.length === 0) throw new Error("No candidates parsed");
    
    return parsed;

  } catch (searchError) {
    console.warn("Search tool failed or returned no results. Falling back to internal knowledge.", searchError);
    
    // --- ATTEMPT 2: Fallback (Internal Knowledge + JSON Schema) ---
    try {
        const fallbackResult = await ai.models.generateContent({
            model,
            contents: basePrompt + "\nNote: Search unavailable. Generate candidates based on your internal knowledge base.",
            config: {
                responseMimeType: "application/json",
                responseSchema: candidateSchema,
                temperature: 0.7
            }
        });

        const candidates = JSON.parse(fallbackResult.text || "[]");
        return parseCandidates(candidates);

    } catch (fallbackError) {
        console.error("Critical error finding startups:", fallbackError);
        return [];
    }
  }
}

export const evaluateStartup = async (
  candidate: StartupCandidate,
  context: Answer[],
  refinementHistory: string[],
  fileData?: { mimeType: string; data: string }
): Promise<EvaluationResult> => {
  const model = "gemini-2.5-flash"; 
  
  const contextString = context.map(a => `Q: ${a.questionText}\nA: ${a.answerText}`).join('\n---\n');
  const refinementString = refinementHistory.length > 0 
    ? `\n\nCRITICAL REFINEMENT RULES FROM USER FEEDBACK (Override standard criteria if conflicting):\n${refinementHistory.map(r => `- ${r}`).join('\n')}`
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
    Task: Research and Evaluate the startup "${candidate.name}" (URL: ${candidate.url || 'Search for it'}).
    
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

  // Define Schema for Fallback
  const evaluationSchema: Schema = {
    type: Type.OBJECT,
    properties: {
        startupName: { type: Type.STRING },
        oneLineSummary: { type: Type.STRING },
        desirability: { 
            type: Type.OBJECT, 
            properties: { score: { type: Type.NUMBER }, reasoning: { type: Type.STRING } },
            required: ['score', 'reasoning']
        },
        viability: { 
            type: Type.OBJECT, 
            properties: { score: { type: Type.NUMBER }, reasoning: { type: Type.STRING } },
            required: ['score', 'reasoning']
        },
        feasibility: { 
            type: Type.OBJECT, 
            properties: { score: { type: Type.NUMBER }, reasoning: { type: Type.STRING } },
            required: ['score', 'reasoning']
        },
        overallScore: { type: Type.NUMBER },
        redFlags: { type: Type.ARRAY, items: { type: Type.STRING } },
        isNoGo: { type: Type.BOOLEAN }
    },
    required: ['startupName', 'desirability', 'viability', 'feasibility', 'overallScore', 'redFlags', 'isNoGo']
  };

  const processResponse = (result: any, fromSearch: boolean) => {
      const jsonText = cleanJson(result.text || "{}");
      const evaluation = JSON.parse(jsonText) as EvaluationResult;

      // Extract grounding sources if available
      const chunks = result.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const sources: string[] = [];
      chunks.forEach((chunk: any) => {
        if (chunk.web?.uri) {
          sources.push(chunk.web.uri);
        }
      });
      
      if (hasFile) {
          sources.unshift("Uploaded Document");
      }
      
      // Deduplicate sources
      evaluation.sources = Array.from(new Set(sources));
      return evaluation;
  };

  // --- ATTEMPT 1: With Google Search (unless file upload is primary and sufficient) ---
  try {
    const parts: any[] = [{ text: promptText + "\nOutput strictly valid JSON." }];
    
    if (fileData) {
      parts.push({
        inlineData: {
          mimeType: fileData.mimeType,
          data: fileData.data
        }
      });
    }

    const result = await ai.models.generateContent({
      model,
      contents: { parts },
      config: {
        tools: [{ googleSearch: {} }],
        systemInstruction: "You are an analytical engine. Output ONLY strictly valid JSON. No markdown."
      }
    });

    return processResponse(result, true);

  } catch (error) {
    console.warn("Evaluation with search failed. Falling back to internal knowledge.", error);

    // --- ATTEMPT 2: Fallback (Internal Knowledge + JSON Schema) ---
    try {
        const parts: any[] = [{ text: promptText }];
        if (fileData) {
            parts.push({
              inlineData: {
                mimeType: fileData.mimeType,
                data: fileData.data
              }
            });
        }

        const result = await ai.models.generateContent({
            model,
            contents: { parts },
            config: {
                responseMimeType: "application/json",
                responseSchema: evaluationSchema,
                temperature: 0.5
            }
        });

        return processResponse(result, false);
    } catch (fatalError) {
        console.error("Evaluation failed completely", fatalError);
        throw new Error("Failed to evaluate startup.");
    }
  }
};

export const formalizeRefinementRule = async (rawInput: string): Promise<string> => {
  const model = "gemini-2.5-flash";
  const prompt = `
    Transform the following user feedback into a specific, actionable evaluation rule for analyzing startups.
    The rule should be phrased as a directive for an AI evaluator.

    User Input: "${rawInput}"

    Examples:
    Input: "We don't want crypto." -> Rule: "Strictly exclude cryptocurrency and blockchain-based business models."
    Input: "They need to be at least series A." -> Rule: "Prioritize startups that have reached at least Series A funding stage."
    Input: "The technology is too early." -> Rule: "Ensure Technology Readiness Level (TRL) is sufficiently high (demonstrated prototype or later)."

    Output only the rule string.
  `;

  try {
    const result = await ai.models.generateContent({
      model,
      contents: prompt,
    });
    return result.text?.trim() || rawInput;
  } catch (error) {
    console.error("Formalization failed:", error);
    return rawInput; // Fallback to raw input
  }
};
