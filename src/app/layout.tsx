import type { Metadata, Viewport } from "next";
import { Inter, Sora } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast";
import { getCurrentUser } from "@/lib/auth-helpers";
import { env } from "@/lib/env";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
  weight: ["600", "700", "800"],
});

export const metadata: Metadata = {
  metadataBase: new URL(env.appUrl),
  title: {
    default: "Helping Station DEU — Serving Beyond Borders",
    template: "%s · Helping Station DEU",
  },
  description:
    "A student-led social and environmental awareness and volunteer action program at Dong-Eui University. Learn, participate, take action, grow together.",
  applicationName: "Helping Station DEU",
  keywords: [
    "Helping Station DEU",
    "Dong-Eui University",
    "volunteer",
    "environmental awareness",
    "student program",
    "community action",
  ],
  authors: [{ name: env.organizerName }],
  openGraph: {
    type: "website",
    siteName: "Helping Station DEU",
    title: "Helping Station DEU — Serving Beyond Borders",
    description:
      "Learn. Participate. Take Action. Grow Together. A student-led social and environmental awareness program.",
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#166534",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // The nav shows an account link, so the session is read once at the root.
  const user = await getCurrentUser();

  return (
    // `data-scroll-behavior` is how Next.js is told we handle smooth scrolling
    // ourselves, so it stops patching it during route transitions.
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${inter.variable} ${sora.variable}`}
    >
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-full focus:bg-leaf-700 focus:px-5 focus:py-3 focus:text-sm focus:font-bold focus:text-white"
        >
          Skip to main content
        </a>
        <ToastProvider>{children}</ToastProvider>
        <span className="sr-only" data-signed-in={user ? user.role : "guest"} />
      </body>
    </html>
  );
}
