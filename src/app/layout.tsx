import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CityLab Explain",
  description: "Plain-language, non-diagnostic explanations of CityLab laboratory reports.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
