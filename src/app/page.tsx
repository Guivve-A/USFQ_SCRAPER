import { ChatWidget } from "@/components/ChatWidget";
import { HomeExperience } from "@/components/HomeExperience";
import { SiteHeader } from "@/components/SiteHeader";
import { getRecentHackathons } from "@/lib/db/queries";
import { resolveScope } from "@/lib/region";

export const revalidate = 300;

export default async function HomePage() {
  let recent: Awaited<ReturnType<typeof getRecentHackathons>> = [];

  try {
    const { regions, includeUnknownOnline } = resolveScope("ecuador-friendly");
    recent = await getRecentHackathons(12, { regions, includeUnknownOnline });
  } catch (error) {
    console.error("[home] Failed to load recent hackathons:", error);
  }

  return (
    <>
      <SiteHeader overlay />
      <main className="flex flex-1 flex-col">
        <HomeExperience recent={recent} />
      </main>
      <ChatWidget />
    </>
  );
}
