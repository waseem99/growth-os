import type { Metadata } from "next";
import "@growth-os/page-engine/styles.css";
import "./globals.css";
import "./publishing.css";

export const metadata: Metadata = {
  title: "GrowthOS Admin",
  description: "Internal multi-brand acquisition operations portal"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
