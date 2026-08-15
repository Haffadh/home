import type { Metadata, Viewport } from "next";

/**
 * Standalone-app metadata for the wall tablet — and only for the wall tablet.
 *
 * It lives in a layout rather than in the page because `page.tsx` is a client
 * component and cannot export `metadata`, and because scoping it here keeps
 * the three logged-in panels ordinary web pages in Safari: they get no
 * manifest, no standalone hints, and no zoom lock.
 *
 * `start_url` and `scope` in the manifest are `/dashboard` with **no pairing
 * token** — the manifest is a public URL, and a token in it would be readable
 * by anyone who fetched it. Pairing stays a one-time thing done on the device.
 */
export const metadata: Metadata = {
  title: "Haffadh Home",
  manifest: "/dashboard.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Home",
    /* "default" keeps the iOS status bar above our content. The alternative,
       "black-translucent", draws the page under it — which on this layout puts
       iOS's own clock on top of the dashboard's, the one element that must
       stay unmistakable. */
    statusBarStyle: "default",
  },
  icons: {
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon.svg", type: "image/svg+xml" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#f6f4f1",
  /* Required for env(safe-area-inset-*) to resolve to anything but 0. Without
     it every safe-area rule below is silently a no-op. */
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
  /* A wall screen nobody should be pinching: a stray zoom would leave the
     dashboard wrong until someone walked over and fixed it. Scoped to this
     route only — the panels stay zoomable. */
  maximumScale: 1,
  userScalable: false,
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
