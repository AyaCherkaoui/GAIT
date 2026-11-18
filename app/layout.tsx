import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import { getUser } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", display: "swap" });

export const metadata: Metadata = {
  title: "Ink",
  description: "An assistant for Reading/Writing Center tutors",
};
export const viewport: Viewport = { themeColor: "#f7f6f2" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  return (
    <html lang="en" className={`${inter.variable} ${bricolage.variable}`}>
      <body>
        {user ? (
          <AppShell user={{ name: user.name, email: user.email, picture: user.picture, role: user.role }} testTools={process.env.GAIT_TEST_TOOLS === "1"}>{children}</AppShell>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
