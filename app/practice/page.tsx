import { SCENARIOS } from "@/lib/scenarios";
import PracticeClient from "./PracticeClient";

export const dynamic = "force-dynamic";

export default async function PracticePage({ searchParams }: { searchParams: Promise<{ scenario?: string | string[] }> }) {
  const { scenario } = await searchParams;
  const id = SCENARIOS.find((s) => s.id === scenario)?.id ?? SCENARIOS[0].id;
  return <PracticeClient initialScenario={id} />;
}
