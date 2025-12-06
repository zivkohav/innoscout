// api/gemini-search.ts
/**
 * USAGE INSTRUCTIONS:
 * 
 * POST /api/gemini-search
 * 
 * Request body:
 * {
 *   "query": "startup name or product to search for",
 *   "context": "(optional) additional context to narrow results"
 * }
 * 
 * SEARCH CONTEXT TIPS:
 * - Use 'context' to refine results when the query name is ambiguous
 * - Examples:
 *   - query: "Neo", context: "biotech company" → finds Neo Biotech, not gaming platforms
 *   - query: "Lumen", context: "metabolic health" → finds Lumen Health, not lighting companies
 *   - query: "Symbiobe", context: "microbiome startup" → disambiguates from similar names
 * - Context can include: industry, technology focus, location, founding year, or any relevant detail
 * - Better context = more accurate results
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI } from "@google/genai";

type StartupCandidate = {
  id: string;
  name: string;
  url: string;
  description: string;
};

type HelpExample = {
  input: string; // what user typed (query + optional context)
  result: string; // micro-copy describing the effect
};

type HelpPayload = {
  alwaysVisible: boolean; // front-end should always show the help affordance
  displayAsTooltip: boolean; // show inline as a tooltip/inline micro-copy
  infoToggleLabel: string; // label for the ℹ️ toggle
  examples: HelpExample[]; // simplified user-friendly examples
  proTips: string[]; // short tips for Criteria Panel
  whyThisWorked?: string; // brief explanation after results load
  mandateEffect?: string; // how the current mandate/context was applied
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

const findStartupsWithGemini = async (
  query: string,
  context?: string,
  meta?: { market?: string; stage?: string; region?: string }
): Promise<{ startups: StartupCandidate[]; help: HelpPayload }> => {
  const apiKey = getApiKey();
  const ai = new GoogleGenAI({
  apiKey,
  apiVersion: "v1", // force stable v1 instead of v1beta
});

  // Use a stable, widely-available model
 const model = "gemini-2.0-flash";

const basePrompt = `
You are a startup research assistant. Your ONLY task is to identify real startups or technology companies that match the user query.

User Query: "__QUERY__"
__CONTEXT__

PRIMARY GOAL:
Return a SHORTLIST of real companies so the user can choose the correct one,
especially when there are multiple startups with similar or confusing names.

ABSOLUTE RULES:

1. TREAT THE QUERY AS A NAME
   - Assume the query is primarily a startup / company / product NAME (e.g., "Symbiobe", "CropMind", "Neo", "Lumen").
   - Do NOT treat it as evaluation criteria or a long description.

2. ALWAYS TRY TO RETURN 2–5 CANDIDATES
   - Your default behavior should be to return BETWEEN 2 AND 5 candidates.
   - Include:
     - The best exact match (if one exists).
     - Close alternatives:
       - Slight spelling variations or typos.
       - Different suffixes: Labs, AI, Systems, Technologies, Biosciences, Therapeutics, etc.
       - Different domain endings: .com, .ai, .io, .bio, .tech, etc.
   - Only return exactly 1 startup if you are strongly convinced there is truly only one realistic match worldwide.

3. DIGITAL FOOTPRINT REQUIREMENT
   For EACH candidate you include:
   - Verify that it has a visible digital footprint:
     - Official website with a plausible domain for that name, OR
     - A Crunchbase / PitchBook / AngelList profile, OR
     - A LinkedIn company page, OR
     - A startup/accelerator/directory listing.
   - If you cannot find ANY digital footprint, DO NOT include that candidate.

4. SOURCES TO USE (MENTALLY)
   - Official websites (preferred).
   - Crunchbase and PitchBook.
   - AngelList and well-known startup directories.
   - Accelerator portfolios (YC, Techstars, etc.).
   - LinkedIn company pages.

5. NO INVENTED COMPANIES
   - Do NOT hallucinate fictional startups.
   - If you are not reasonably sure a company exists, do not include it.

6. OUTPUT FORMAT (STRICT JSON)
Output ONLY JSON in this shape, with NO extra commentary:

{
  "startups": [
    {
      "name": "Company name",
      "url": "https://official-website-or-main-profile",
      "description": "One sentence describing their core technology or product."
    }
  ]
}


STRUCTURE EXAMPLE (NOT REAL DATA):

{
  "startups": [
    {
      "name": "Symbiobe",
      "url": "https://symbiobe.com/",
      "description": "Microbiome-focused biotech company working on symbiotic solutions."
    },
    {
      "name": "Symbiome",
      "url": "https://symbiome.com/",
      "description": "Skincare and health brand using microbiome science."
    },
    {
      "name": "SymBio Labs",
      "url": "https://symbiolabs.com/",
      "description": "Biotech company providing symbiotic biological products."
    }
  ]
}

CONSTRAINTS:
- Return 2–5 startups whenever possible.
- Prefer: [1 best exact match + 1–4 close alternatives].
- If nothing reasonable is found at all, return: { "startups": [] }.

ADDITIONAL HELP FOR TRICKY NAMES:
- FIRST try to find an exact-name match (case-insensitive) for the query.
- If you cannot find an exact match, TRY THESE STRATEGIES:
  1) Try common domain suffixes for the name: .com, .io, .ai, .co, .tech, .jp (e.g., "Symbiobe.com", "Symbiobe.jp").
  2) Try common company suffixes: "Labs", "Technologies", "AI", "Systems", "Solutions".
  3) Try minor spelling variants (single-letter swaps or common typos).
- Only include companies you are reasonably confident exist (visible website/profile).
- Prefer official website URLs when available.
`;

// Render prompt for the query including optional structured metadata
const renderPrompt = (q: string, c?: string, m?: { market?: string; stage?: string; region?: string }) => {
  const pieces: string[] = [];
  if (c) pieces.push(`Context/Hint: "${c}"`);
  if (m?.market) pieces.push(`Market: ${m.market}`);
  if (m?.stage) pieces.push(`Stage: ${m.stage}`);
  if (m?.region) pieces.push(`Region: ${m.region}`);
  const contextPrompt = pieces.length > 0 ? pieces.join(" | ") + "\n\n" : '';
  return `${contextPrompt}${basePrompt.replace("__QUERY__", q)}`;
};

const callGemini = async (p: string) => {
  const r = await (ai.models as any).generateContent({
    model,
    contents: p,
    generationConfig: { temperature: 0.25 },
  });
  const raw =
    (r as any).text ?? (r as any).candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  return cleanJson(raw || "{}");
};


// First pass: original query (include meta if provided)
const firstJson = await callGemini(renderPrompt(query, context, meta));
let parsed: any;
try {
  parsed = JSON.parse(firstJson);
} catch (e) {
  parsed = { startups: [] };
}

let list = Array.isArray(parsed.startups) ? parsed.startups : [];

// If no close/exact match (by name) found, retry with explicit domain/name-variant instructions
const hasExact = list.some(
  (c: any) => typeof c.name === "string" && c.name.trim().toLowerCase() === query.trim().toLowerCase()
);

if (!hasExact) {
  const retryPrompt =
    renderPrompt(query, context, meta) +
    "\n\nRETRY: If you did not find an exact-name match, now explicitly try the domain and name-variant strategies listed above and return up to 5 best candidates.";

  const retryJson = await callGemini(retryPrompt);
  try {
    const retryParsed = JSON.parse(retryJson);
    const retryList = Array.isArray(retryParsed.startups) ? retryParsed.startups : [];
    // prefer exact-name matches from retry, otherwise merge (dedupe by url or name)
    const merged = [...retryList, ...list];
    const seen = new Set<string>();
    list = merged.filter((c: any) => {
      const key = (c.url || c.name || "").toLowerCase();
      if (!key) return false;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  } catch (e) {
    // keep original list
  }
}

console.log("[/api/gemini-search] startups from Gemini (final):", list);

const startups = list.map((c: any, idx: number) => ({
  id: `gemini-${idx}`,
  name: c.name || "Unknown Name",
  url: c.url || "",
  description: c.description || "No description available.",
}));

// Construct simplified, user-friendly examples & tips (extracted/simplified from file header)
const examples: HelpExample[] = [
  { input: 'Neo + biotech', result: 'Finds Neo Biotech (company), not gaming platforms.' },
  { input: 'Lumen + metabolic health', result: 'Finds Lumen Health (metabolic health startup), not lighting companies.' },
  { input: 'Symbiobe + microbiome', result: 'Finds microbiome-focused Symbiobe, not unrelated brands.' },
  // optional fourth concise example
  { input: 'CropMind + agriculture', result: 'Finds agri-tech CropMind, not unrelated software.' },
];

const proTips = [
  'Use short context words (industry, tech, location) to narrow ambiguous names.',
  'If a name is ambiguous, try adding "company", "labs", or a location (e.g., "Berlin").',
  'The system prefers official websites or well-known profiles when picking candidates.',
];

const metaParts: string[] = [];
if (meta?.market) metaParts.push(`market: ${meta.market}`);
if (meta?.stage) metaParts.push(`stage: ${meta.stage}`);
if (meta?.region) metaParts.push(`region: ${meta.region}`);

const mandateEffect = [
  context ? `Context "${context}" was used to bias results toward that industry/setting.` : null,
  metaParts.length ? `Additional filters applied (${metaParts.join(', ')}).` : null,
]
  .filter(Boolean)
  .join(' ')
  || 'No extra context provided — results favor best name matches and domain/name variants.';

const whyThisWorked = hasExact
  ? `An exact-name match was found for "${query}". Context was used to disambiguate nearby matches.`
  : startups.length > 0
    ? `No exact-name match for "${query}". The search tried domain and name-variant strategies (common suffixes and domain endings) and returned likely candidates. ${context ? `Context "${context}" guided the results.` : ''} ${metaParts.length ? `Filters (${metaParts.join(', ')}) were applied.` : ''}`
    : `No reasonable candidates found for "${query}". Try adding context (industry, location, or "company") or structured filters (market/stage/region) to improve results.`;

// Return startups plus help metadata
return {
  startups,
  help: {
    alwaysVisible: true,
    displayAsTooltip: true,
    infoToggleLabel: 'Search Tips (ℹ️)',
    examples,
    proTips,
    whyThisWorked,
    mandateEffect,
  },
};

};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { query, context, market, stage, region } = req.body as { query?: string; context?: string; market?: string; stage?: string; region?: string };

    if (!query || !query.trim()) {
      return res.status(400).json({ error: "Missing 'query' in request body" });
    }

    console.log("[/api/gemini-search] Query:", query, { market, stage, region });

    // handle new return shape, pass structured meta
    const result = await findStartupsWithGemini(query, context, { market, stage, region });
    const { startups, help } = result;

    return res.status(200).json({ startups, help });
  } catch (error: any) {
    console.error("Error in /api/gemini-search:", error);
    return res
      .status(500)
      .json({ error: error?.message || "Internal server error" });
  }
}
