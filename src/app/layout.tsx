import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Pixelify_Sans } from "next/font/google";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"], weight: ["500", "700"] });
const pixel = Pixelify_Sans({ variable: "--font-pixelify-sans", subsets: ["latin"], weight: ["500", "700"] });

export const metadata: Metadata = {
  title: { default: "mcrep.gg: Minecraft Player reputation", template: "%s | mcrep.gg" },
  description: "Check a Minecraft Java Edition Player's Reputation before you trade or play with them.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable} ${pixel.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <SiteHeader />
        <div className="flex flex-1 flex-col">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
