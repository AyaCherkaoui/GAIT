import type { Metadata, Viewport } from "next";
import { Figtree, Newsreader } from "next/font/google";
import { getUser } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import "./globals.css";

const figtree = Figtree({ subsets: ["latin"], variable: "--font-figtree", display: "swap" });
const newsreader = Newsreader({ subsets: ["latin"], variable: "--font-newsreader", display: "swap", style: ["normal", "italic"] });

export const metadata: Metadata = {
  title: "GAIT",
  description: "An assistant for Reading/Writing Center tutors",
};
export const viewport: Viewport = { themeColor: "#111d3b" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  return (
    <html lang="en" className={`${figtree.variable} ${newsreader.variable}`}>
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
