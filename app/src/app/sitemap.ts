import type { MetadataRoute } from "next";
import { getAtlasSummary } from "@/lib/atlas";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://china-data-atlas-gemini-4-neon-r1.vercel.app";
  const summary = getAtlasSummary();
  const lastModified = new Date(summary.generated_at);

  return [
    { url: `${baseUrl}/`, lastModified, changeFrequency: "monthly", priority: 1.0 },
    { url: `${baseUrl}/explore`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/methodology`, lastModified, changeFrequency: "monthly", priority: 0.7 },
    ...summary.indicators.map((ind) => ({
      url: `${baseUrl}/indicators/${ind.indicator_id}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.9,
    })),
  ];
}
