import type { Metadata } from "next";
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
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
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
