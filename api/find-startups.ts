// api/find-startups.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { findStartups } from "./lib/geminiService";

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