import SearchClient from "./SearchClient";

export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const { q } = await searchParams;
  return <SearchClient initialQ={typeof q === "string" ? q.slice(0, 200) : ""} />;
}
