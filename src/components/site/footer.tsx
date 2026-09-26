import Link from "next/link";
import { Leaf, Mail, MapPin, ShieldCheck } from "lucide-react";
import { env } from "@/lib/env";

const columns = [
  {
    title: "Programme",
    links: [
      { href: "/event", label: "About the event" },
      { href: "/register", label: "Register" },
      { href: "/account", label: "My participation" },
    ],
  },
  {
    title: "Lucky draw",
    links: [
      { href: "/draw", label: "Draw screen" },
      { href: "/winners", label: "Previous winners" },
      { href: "/rules", label: "Rules" },
    ],
  },
  {
    title: "Information",
    links: [
      { href: "/privacy", label: "Privacy policy" },
      { href: "/event#activities", label: "Activities" },
      { href: "/event#journey", label: "Programme journey" },
    ],
  },
];

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="no-print mt-auto border-t border-leaf-900/10 bg-leaf-950 text-leaf-50">
      <div className="container-page grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-5 lg:py-16">
        <div className="lg:col-span-2">
          <div className="flex items-center gap-2.5">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-leaf-600 text-white">
              <Leaf className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="font-display text-lg font-extrabold">Helping Station DEU</span>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-leaf-100/80">
            Serving Beyond Borders — Together We Grow. A student-led social and environmental
            awareness and volunteer action programme connecting students, the university and the
            wider community.
          </p>
          <p className="mt-5 flex items-center gap-2 text-sm text-leaf-100/70">
            <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
            {env.organizerName}
          </p>
          <p className="mt-1.5 flex items-center gap-2 text-sm text-leaf-100/70">
            <Mail className="h-4 w-4 shrink-0" aria-hidden="true" />
            <a href={`mailto:${env.contactEmail}`} className="hover:text-leaf-50 hover:underline">
              {env.contactEmail}
            </a>
          </p>
        </div>

        {columns.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <h2 className="font-display text-sm font-bold uppercase tracking-[0.14em] text-leaf-300">
              {column.title}
            </h2>
            <ul className="mt-4 space-y-2.5">
              {column.links.map((link) => (
                <li key={link.href + link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-leaf-100/80 transition hover:text-white hover:underline"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="border-t border-leaf-50/10">
        <div className="container-page flex flex-col gap-3 py-6 text-xs text-leaf-100/60 sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} Helping Station DEU. Student volunteer programme.</p>
          <p className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Draw results are selected on the server with a verifiable, auditable process.
          </p>
        </div>
      </div>
    </footer>
  );
}
