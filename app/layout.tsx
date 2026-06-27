import type { Metadata } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["opsz"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-jb",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://frontdesk.aicoo.app"),
  title: {
    default: "Frontdesk — Send a link, not a document",
    template: "%s · Frontdesk",
  },
  description:
    "Frontdesk turns your AI COO into a shareable, access-bounded front desk. Drop one link — anyone can ask it questions and book time with you. No signup, no back-and-forth. Built on Aicoo.",
  keywords: [
    "AI COO",
    "Aicoo",
    "agent-to-agent",
    "shareable agent",
    "scheduling",
    "agent network",
  ],
  authors: [{ name: "Frontdesk" }],
  openGraph: {
    title: "Frontdesk — Send a link, not a document",
    description:
      "Your AI COO, as a front desk anyone can talk to. One scoped link handles the questions and books the meeting.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${inter.variable} ${jetbrains.variable}`}
      suppressHydrationWarning
    >
      <body>{children}</body>
    </html>
  );
}
