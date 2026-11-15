import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import WelcomeClient from "./WelcomeClient";

export const dynamic = "force-dynamic";

export default async function WelcomePage() {
  const user = await getUser();
  if (!user) redirect("/login");
  if (user.onboarded) redirect("/");
  return <WelcomeClient />;
}
