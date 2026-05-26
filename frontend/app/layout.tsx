import type { Metadata, Viewport } from "next";
import "./globals.css";
import DashboardShell from "./components/DashboardShell";
import { AuthProvider } from "./context/AuthContext";
import { RealtimeProvider } from "./context/RealtimeContext";
import { GlobalRealtimeProvider } from "./context/GlobalRealtimeContext";
import { MusicProvider } from "./context/MusicContext";

export const metadata: Metadata = {
  title: "Haffadh Home",
  description: "Smart Home Hub",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Haffadh Home",
    startupImage: [{ url: "/apple-touch-icon.png" }],
  },
  icons: {
    icon: [
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      { url: "/apple-touch-icon-167.png", sizes: "167x167", type: "image/png" },
      { url: "/apple-touch-icon-152.png", sizes: "152x152", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  minimumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no, viewport-fit=cover" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Haffadh Home" />
      </head>
      <body className="h-full antialiased overflow-hidden overflow-x-hidden">
        <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[900px] h-[400px] bg-blue-500/20 blur-[120px] rounded-full pointer-events-none z-0" />
        <AuthProvider>
          <RealtimeProvider>
            <GlobalRealtimeProvider>
              <MusicProvider>
                <DashboardShell>{children}</DashboardShell>
              </MusicProvider>
            </GlobalRealtimeProvider>
          </RealtimeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
