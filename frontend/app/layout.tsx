import type { Metadata } from "next";
import "./globals.css";
import DashboardShell from "./components/DashboardShell";
import { AuthProvider } from "./context/AuthContext";
import { RealtimeProvider } from "./context/RealtimeContext";

export const metadata: Metadata = {
  title: "Smart Home Hub",
  description: "Smart Home Hub",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="h-full antialiased overflow-hidden overflow-x-hidden">
        <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[900px] h-[400px] bg-blue-500/20 blur-[120px] rounded-full pointer-events-none z-0" />
        <AuthProvider>
          <RealtimeProvider>
            <DashboardShell>{children}</DashboardShell>
          </RealtimeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
