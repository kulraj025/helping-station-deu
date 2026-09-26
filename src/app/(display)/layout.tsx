import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Draw display",
  robots: { index: false, follow: false },
};

/**
 * The projector layout.
 *
 * Deliberately has no navbar, no footer and no demo banner: at 3 metres away,
 * on a borrowed projector, every stray pixel is a distraction. The page paints
 * a dark background so the screen is not blinding in a darkened hall.
 */
export default function DisplayLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-leaf-950 bg-grid-lines-dark">
      <div className="mx-auto flex min-h-dvh max-w-7xl flex-col justify-center px-4 py-8 sm:px-8">
        {children}
      </div>
    </div>
  );
}
