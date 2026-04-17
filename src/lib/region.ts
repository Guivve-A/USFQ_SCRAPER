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

const LATAM_PATTERN =
  /(latam|latin america|latinoam|iberoam|sudameric|south america|américa latina|amer[ií]ca latina|hispanoam)/;

const OTHER_COUNTRY_PATTERN =
  /(argentina|brazil|brasil|mexico|méxico|colombia|chile|peru|perú|venezuela|bolivia|paraguay|uruguay|india|united states|\busa\b|\bu\.s\.\b|\bus\b|canada|canadá|united kingdom|\buk\b|germany|alemania|france|francia|italy|italia|spain|españa|espana|china|japan|japón|australia|nigeria|kenya|egypt|egipto)/;

export function normalizeRegion(
  location: string | null | undefined,
  isOnline: boolean
): Region | null {
  const raw = (location ?? "").toLowerCase().trim();

  if (raw && ECUADOR_PATTERN.test(raw)) return "ecuador";
  if (raw && LATAM_PATTERN.test(raw)) return "latam";
  if (raw && OTHER_COUNTRY_PATTERN.test(raw)) return "other";
  if (isOnline) return "global";
  if (!raw) return null;

  return "other";
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
