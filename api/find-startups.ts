// api/find-startups.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { query } = req.body as { query?: string };

    return res.status(200).json({
      message: "API route is alive",
      query: query ?? null,
    });
  } catch (error: any) {
    console.error("Minimal handler error:", error);
    return res
      .status(500)
      .json({ error: error?.message || "Internal server error" });
  }
}