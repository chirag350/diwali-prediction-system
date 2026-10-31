import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "Shwāsa — The air, a little ahead.",
    template: "%s · Shwāsa",
  },
  description:
    "Understand the air around you. Explainable PM2.5 forecasts, Diwali replays, and an honest model report card for Delhi-NCR.",
  applicationName: "Shwāsa",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#315740",
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
