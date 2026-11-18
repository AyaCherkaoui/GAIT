import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import CoursesClient from "./CoursesClient";

export const dynamic = "force-dynamic";

export default async function CoursesPage() {
  const user = await getUser();
  if (user?.role !== "director") redirect("/");
  return <CoursesClient />;
}
