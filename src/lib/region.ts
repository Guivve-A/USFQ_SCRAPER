export type Region = "ecuador" | "latam" | "global" | "other";

export type Scope =
  | "ecuador-friendly"
  | "ecuador-only"
  | "latam-online"
  | "global-online"
  | "all";

export type ScopeResolution = {
  regions: Region[] | null;
  includeUnknownOnline: boolean;
  forceOnline: boolean | undefined;
};

const ECUADOR_PATTERN =
  /(ecuador|quito|guayaquil|cuenca|loja|manta|ambato|machala|riobamba|portoviejo|ibarra|esmeraldas|latacunga|tulcán|tulcan)/;

// Generic LATAM keywords (usually appear in online event descriptions)
const LATAM_KEYWORD_PATTERN =
  /(latam|latin america|latinoam|iberoam|sudameric|south america|américa latina|amer[ií]c[ao] latina|hispanoam)/;

// Explicit LATAM city/country names (used for presential events)
const LATAM_LOCATION_PATTERN =
  /(mexico|méxico|colombia|bogotá|bogota|perú|peru|lima|brazil|brasil|são paulo|sao paulo|rio de janeiro|argentina|buenos aires|chile|santiago|venezuela|caracas|bolivia|la paz|paraguay|asunción|asuncion|uruguay|montevideo|cuba|havana|panama|panamá|costa rica|san josé|guatemala|honduras|el salvador|nicaragua|dominicana|santo domingo|puerto rico)/;

const OTHER_COUNTRY_PATTERN =
  /(united states|\busa\b|\bu\.s\.\b|canada|canadá|united kingdom|\buk\b|germany|alemania|france|francia|italy|italia|spain|españa|espana|portugal|india|bangalore|bengaluru|mumbai|delhi|hyderabad|china|beijing|shanghai|japan|japón|tokyo|osaka|australia|sydney|melbourne|nigeria|kenya|egypt|egipto|singapore|southkorea|seoul|russia|moscow|netherlands|amsterdam|sweden|stockholm|norway|denmark|finland|switzerland|austria|poland|ukraine|turkey|israel|uae|dubai)/;

export function normalizeRegion(
  location: string | null | undefined,
  isOnline: boolean
): Region | null {
  const raw = (location ?? "").toLowerCase().trim();

  if (!raw) return null;

  // Ecuador must always be explicit in the location string — no fallback to ecuador
  if (ECUADOR_PATTERN.test(raw)) return "ecuador";

  if (!isOnline) {
    // Presential events: classify purely by explicit location keywords.
    // Unknown city → "other" (never assume Ecuador).
    if (LATAM_LOCATION_PATTERN.test(raw)) return "latam";
    return "other";
  }

  // Online events: broader heuristics are acceptable
  if (LATAM_KEYWORD_PATTERN.test(raw) || LATAM_LOCATION_PATTERN.test(raw)) return "latam";
  if (OTHER_COUNTRY_PATTERN.test(raw)) return "other";
  return "global";
}

export function resolveScope(scope: Scope | null | undefined): ScopeResolution {
  switch (scope) {
    case "ecuador-only":
      return {
        regions: ["ecuador"],
        includeUnknownOnline: false,
        forceOnline: undefined,
      };
    case "latam-online":
      return {
        regions: ["ecuador", "latam"],
        includeUnknownOnline: true,
        forceOnline: true,
      };
    case "global-online":
      return {
        regions: ["global"],
        includeUnknownOnline: true,
        forceOnline: true,
      };
    case "all":
      return {
        regions: null,
        includeUnknownOnline: true,
        forceOnline: undefined,
      };
    case "ecuador-friendly":
    default:
      return {
        regions: ["ecuador", "latam", "global"],
        includeUnknownOnline: true,
        forceOnline: undefined,
      };
  }
}

export const SCOPE_VALUES: readonly Scope[] = [
  "ecuador-friendly",
  "ecuador-only",
  "latam-online",
  "global-online",
  "all",
] as const;

export function isScope(value: string | null | undefined): value is Scope {
  if (!value) return false;
  return (SCOPE_VALUES as readonly string[]).includes(value);
}
