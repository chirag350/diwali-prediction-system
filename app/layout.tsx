import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "Shwāsa — Delhi-NCR air quality",
    template: "%s · Shwāsa",
  },
  description:
    "Air quality estimates for Delhi-NCR. Compare areas, view past Diwali readings, and check model results.",
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
