import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "./context/AuthContext";

/**
 * Hearth's single typeface. One family, weight + scale + colour carry the
 * hierarchy — no second family, no display serif. Chosen for humanist warmth
 * at large sizes (the dashboard clock) and high legibility at small sizes for
 * a reader who is not a native English speaker.
 */
const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Abdullah Tasks",
  description: "Daily task management",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${figtree.variable}`}>
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
