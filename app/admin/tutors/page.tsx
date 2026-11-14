import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import TutorsClient from "./TutorsClient";

export const dynamic = "force-dynamic";

export default async function TutorsPage() {
  const user = await getUser();
  if (user?.role !== "director") redirect("/");
  return <TutorsClient myEmail={user.email.toLowerCase()} />;
}
