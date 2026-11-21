import { getSessionType } from "@/lib/session-types";
import SessionForm from "./SessionForm";

export const dynamic = "force-dynamic";

export default async function SessionPage({ searchParams }: { searchParams: Promise<{ type?: string | string[] }> }) {
  const { type } = await searchParams;
  const id = typeof type === "string" ? getSessionType(type)?.id ?? "" : "";
  return <SessionForm initialType={id} />;
}
