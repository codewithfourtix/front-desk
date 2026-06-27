import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
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
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script
          // Set the theme class before paint to avoid a flash of the wrong theme.
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}if(t==='dark'){document.documentElement.classList.add('dark');}}catch(e){}})();`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
