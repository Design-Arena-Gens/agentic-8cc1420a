import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ShortShift Agent",
  description:
    "Autonomous assistant for planning, optimizing, and publishing YouTube Shorts.",
  metadataBase: new URL("https://agentic-8cc1420a.vercel.app"),
  openGraph: {
    title: "ShortShift Agent",
    description:
      "Plan, optimize, and publish your YouTube Shorts with a streamlined workflow.",
    url: "https://agentic-8cc1420a.vercel.app",
    siteName: "ShortShift Agent",
  },
  twitter: {
    card: "summary_large_image",
    title: "ShortShift Agent",
    description:
      "Upload your Shorts faster with AI-assisted metadata and scheduling.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
