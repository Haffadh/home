/**
 * Next.js App Router `template.tsx` — remounts on navigation, giving every
 * routed page the single Hearth page-enter: fade + small rise. No exits.
 *
 * Deliberately CSS, not Framer: the enter runs at mount, and a JS
 * reduced-motion read only lands after the first paint, so a Framer-driven
 * enter animated even when the OS asked for no motion. See
 * `.hearth-page-enter` in globals.css. This also keeps Framer off the mount
 * path of every route.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="hearth-page-enter h-full">{children}</div>;
}
