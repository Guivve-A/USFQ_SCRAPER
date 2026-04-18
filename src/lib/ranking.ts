import type { Hackathon } from "@/types/hackathon";

type SemanticHit = Hackathon & { similarity: number };

const DAY_MS = 24 * 60 * 60 * 1_000;

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function deadlineProximityScore(deadline: string | null | undefined): number {
  const target = parseDate(deadline);
  if (!target) {
    return 0.25;
  }

  const diffDays = (target.getTime() - Date.now()) / DAY_MS;

  if (diffDays < -2) return 0.05;
  if (diffDays < 0) return 0.12;
  if (diffDays <= 14) return 1 - diffDays / 20;
  if (diffDays <= 45) return 0.65 - (diffDays - 14) / 120;
  if (diffDays <= 180) return 0.35;
  return 0.22;
}

function freshnessScore(dateLike: string | null | undefined): number {
  const target = parseDate(dateLike);
  if (!target) {
    return 0.2;
  }

  const ageDays = (Date.now() - target.getTime()) / DAY_MS;
  if (ageDays <= 0) return 1;
  if (ageDays <= 7) return 0.95 - ageDays * 0.05;
  if (ageDays <= 30) return 0.6 - (ageDays - 7) * 0.01;
  if (ageDays <= 90) return 0.3 - (ageDays - 30) * 0.003;
  return 0.08;
}

function qualityScore(item: Hackathon): number {
  let score = 0;

  if (item.description && item.description.length >= 80) score += 3;
  else if (item.description) score += 2;

  if (item.start_date) score += 2;
  if (item.deadline) score += 2;
  if (item.organizer) score += 1;
  if (item.image_url) score += 1;
  if ((item.tags?.length ?? 0) > 0) score += 1;
  if (item.prize_pool || item.prize_amount) score += 1;

  return clamp01(score / 11);
}

function onlinePriority(item: Hackathon): number {
  return item.is_online ? 1 : 0.15;
}

/**
 * Scores how relevant the event is to Ecuadorian/LATAM participants.
 * Ecuador presential > LATAM > globally accessible online > presential elsewhere.
 */
function regionScore(item: Hackathon): number {
  const { region, is_online } = item;

  if (region === "ecuador") return 1.0;
  if (region === "latam") return 0.72;

  if (is_online) {
    if (region === "global" || region === null) return 0.50;
    if (region === "other") return 0.35;
  }

  // Presential event outside Ecuador/LATAM — largely inaccessible
  return 0.08;
}

/**
 * Logarithmic prize score: $1 k → ~0.50, $10 k → ~0.67, $100 k → ~0.83.
 * Falls back to 0.4 if only prize_pool text exists, 0.1 if nothing.
 */
function prizeScore(item: Hackathon): number {
  if (item.prize_amount && item.prize_amount > 0) {
    return clamp01(Math.log10(item.prize_amount + 1) / 6);
  }
  if (item.prize_pool) return 0.4;
  return 0.1;
}

function semanticRankScore(item: SemanticHit): number {
  const similarity = clamp01(item.similarity);
  const freshness = freshnessScore(item.scraped_at ?? item.created_at ?? null);
  const deadline = deadlineProximityScore(item.deadline ?? item.start_date);
  const quality = qualityScore(item);
  const online = onlinePriority(item);
  const region = regionScore(item);

  return (
    similarity * 0.55 +
    region   * 0.18 +
    online   * 0.12 +
    deadline * 0.09 +
    quality  * 0.04 +
    freshness * 0.02
  );
}

function catalogRankScore(item: Hackathon): number {
  const freshness = freshnessScore(item.scraped_at ?? item.created_at ?? null);
  const deadline = deadlineProximityScore(item.deadline ?? item.start_date);
  const quality = qualityScore(item);
  const online = onlinePriority(item);
  const region = regionScore(item);
  const prize = prizeScore(item);

  return (
    region   * 0.35 +
    deadline * 0.28 +
    online   * 0.15 +
    quality  * 0.12 +
    prize    * 0.07 +
    freshness * 0.03
  );
}

function compareByDateAsc(a: string | null, b: string | null): number {
  const ad = parseDate(a)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  const bd = parseDate(b)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  return ad - bd;
}

export function rankSemanticResults<T extends SemanticHit>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const scoreDiff = semanticRankScore(b) - semanticRankScore(a);
    if (Math.abs(scoreDiff) > 0.0001) {
      return scoreDiff;
    }

    return compareByDateAsc(a.deadline ?? a.start_date, b.deadline ?? b.start_date);
  });
}

export function rankCatalogHackathons<T extends Hackathon>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const scoreDiff = catalogRankScore(b) - catalogRankScore(a);
    if (Math.abs(scoreDiff) > 0.0001) {
      return scoreDiff;
    }

    return compareByDateAsc(a.deadline ?? a.start_date, b.deadline ?? b.start_date);
  });
}
