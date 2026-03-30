import type { NextApiRequest, NextApiResponse } from "next";

const INSPECTION_API_BASE = "https://inspection-six.vercel.app/api/reports";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { rq_number } = req.query;

  if (!rq_number || typeof rq_number !== "string") {
    return res.status(400).json({ error: "rq_number is required" });
  }

  try {
    const response = await fetch(
      `${INSPECTION_API_BASE}/${encodeURIComponent(rq_number)}`,
      {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      }
    );

    if (response.status === 404) {
      return res.status(404).json({ error: "Not found" });
    }

    if (!response.ok) {
      return res.status(502).json({ error: "Failed to fetch from inspection API" });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error("Error proxying inspection report:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
