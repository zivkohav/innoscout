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
  const prompt = `
    User Query: "${query}"

    Task: Search for startups or technology companies that match this name or description.
    
    Instructions:
    1. **Disambiguate**: If the query is a specific name (e.g., "Neo"), look for distinct companies with that name or similar variations (e.g., "Neo Cyber", "Neo Materials").
    2. **Digital Footprint**: For each company, prioritize finding their **Official Website**. If not found, find their **LinkedIn Company Page**.
    3. **Description**: Provide a brief 1-sentence description of their core technology.

    Retrieve up to 5 distinct, real candidates.

    Output strictly as a JSON array of objects with keys: "name", "url", "description".
    Do not add any markdown formatting, code blocks, or explanations outside the JSON.
    Ensure the JSON is valid.
  `;

  try {
    const result = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }], // Enable search to find real companies
        systemInstruction: "You are a search assistant. You return ONLY raw JSON arrays. No markdown, no preambles."
      }
    });

    const rawText = result.text || "[]";
    const jsonText = cleanJson(rawText);
    
    // Safety check for empty response
    if (!jsonText || jsonText === "[]") {
        console.warn("Empty JSON response from findStartups");
        if (rawText.length > 20) console.log("Raw text was:", rawText);
        return [];
    }

    const candidates = JSON.parse(jsonText);
    
    // Add IDs
    return candidates.map((c: any, idx: number) => ({
      id: `candidate-${idx}`,
      name: c.name,
      url: c.url,
      description: c.description
    }));

  } catch (error) {
    console.error("Error finding startups:", error);
    return [];
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
    2. Supplement with Google Search ONLY if the document is missing critical external context (e.g. competitors, recent news).
    3. The document is the primary source of truth for Feasibility/Viability.
    `;
  } else {
    instructions = `
    1. Use Google Search to find current information about ${candidate.name} (products, news, team, traction).
    2. Analyze the startup based on the search results.
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

    Output format: strictly valid JSON.
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
    
    Return ONLY the JSON object.
  `;

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
        tools: [{ googleSearch: {} }],
        systemInstruction: "You are an analytical engine. Output ONLY strictly valid JSON. No markdown."
      }
    });

    const jsonText = cleanJson(result.text || "{}");
    const evaluation = JSON.parse(jsonText) as EvaluationResult;
    
    // Extract grounding sources
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
  } catch (error) {
    console.error("Evaluation failed", error);
    throw new Error("Failed to evaluate startup.");
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