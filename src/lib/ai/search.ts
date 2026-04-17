import { generateEmbedding } from "@/lib/ai/embeddings";
import { matchHackathonsByEmbedding } from "@/lib/db/queries";
import { rankSemanticResults } from "@/lib/ranking";
import { resolveScope } from "@/lib/region";
import type { Hackathon, SearchParams } from "@/types/hackathon";

export async function searchHackathons(
  params: SearchParams
): Promise<Array<Hackathon & { similarity: number }>> {
  const query = params.query?.trim();
  if (!query) {
    throw new Error("searchHackathons requires a non-empty query.");
  }

  const embedding = await generateEmbedding(query);

  const { regions, includeUnknownOnline, forceOnline } = resolveScope(params.scope);
  const online = params.online ?? forceOnline;

  const results = await matchHackathonsByEmbedding(embedding, {
    online,
    platform: params.platform,
    matchCount: params.limit ?? 10,
    regions,
    includeUnknownOnline,
  });

  return rankSemanticResults(results);
}
