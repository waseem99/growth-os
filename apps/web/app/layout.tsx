import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GrowthOS Renderer",
  description: "High-performance multi-brand landing-page renderer"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
