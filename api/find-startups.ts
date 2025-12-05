// api/find-startups.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";

// Inline dummy implementation to avoid module resolution issues.
// Once everything works, we can move real Gemini logic back in.
type StartupCandidate = {
  id: string;
  name: string;
  url: string;
  description: string;
};

const findStartups = async (query: string): Promise<StartupCandidate[]> => {
  const trimmed = (query || "").trim() || "Unknown";

  return [
    {
      id: "dummy-1",
      name: `${trimmed} AI`,
      url: "https://example.com/ai",
      description: `Dummy startup 1 for query "${trimmed}".`,
    },
    {
      id: "dummy-2",
      name: `${trimmed} Labs`,
      url: "https://example.com/labs",
      description: `Dummy startup 2 for query "${trimmed}".`,
    },
  ];
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

    const startups = await findStartups(query);

    return res.status(200).json({ startups });
  } catch (error: any) {
    console.error("Error in /api/find-startups:", error);
    return res
      .status(500)
      .json({ error: error?.message || "Internal server error" });
  }
}
