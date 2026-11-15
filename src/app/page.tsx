import { ExplainerApp } from "@/components/ExplainerApp";
import { listFixtures } from "@/lib/server/fixtures";

export const dynamic = "force-dynamic";

export default async function Home() {
  const fixtures = await listFixtures();
  return <ExplainerApp fixtures={fixtures} />;
}
