import { generateEmbedding } from "@/lib/ai/embeddings";
import { matchHackathonsByEmbedding } from "@/lib/db/queries";
import type { Hackathon, SearchParams } from "@/types/hackathon";

export async function searchHackathons(
  params: SearchParams
): Promise<Array<Hackathon & { similarity: number }>> {
  const query = params.query?.trim();
  if (!query) {
    throw new Error("searchHackathons requires a non-empty query.");
  }

  const embedding = await generateEmbedding(query);

  return matchHackathonsByEmbedding(embedding, {
    online: params.online,
    platform: params.platform,
    matchCount: params.limit ?? 10,
  });
}
