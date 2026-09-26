import Link from "next/link";
import { Compass, Home, MapPin, Search } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { LeafDivider } from "@/components/site/illustrations";

/**
 * The body of the 404 page.
 *
 * Shared by two boundaries that render it in different chrome:
 *  - `app/not-found.tsx`, for a URL that matches no route at all (the root
 *    layout only — no navbar, so this has to stand on its own), and
 *  - `app/(site)/not-found.tsx`, for a `notFound()` call from inside a public
 *    page, which keeps the navbar, footer and demo banner.
 *
 * The links are the ones people actually want at this point: home, the current
 * event, the rules, and where to register.
 */
export function NotFoundBody() {
  return (
    <div className="flex-1">
      <section className="bg-leaf-50 relative overflow-hidden py-16 sm:py-20">
        <div className="container-page relative">
          <div className="mx-auto max-w-xl text-center">
            <p className="font-display text-6xl font-extrabold text-leaf-200 sm:text-7xl">404</p>
            <h1 className="mt-2 font-display text-2xl font-extrabold text-leaf-950 sm:text-3xl">
              We could not find that page
            </h1>
            <p className="mt-3 text-base leading-relaxed text-slate-700">
              The link may be old, or the event may have been unpublished after you bookmarked it.
              Nothing has been lost — try one of the links below.
            </p>

            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <ButtonLink href="/" size="lg">
                <Home className="h-4 w-4" aria-hidden="true" />
                Go to the home page
              </ButtonLink>
              <ButtonLink href="/register" variant="secondary" size="lg">
                <MapPin className="h-4 w-4" aria-hidden="true" />
                Register for an event
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>

      <LeafDivider />

      <section className="bg-white py-14">
        <div className="container-page">
          <h2 className="text-center font-display text-lg font-extrabold text-leaf-950">
            Where would you like to go?
          </h2>
          <ul className="mx-auto mt-6 grid max-w-3xl gap-3 sm:grid-cols-2">
            {[
              { href: "/event", label: "The current event", hint: "Times, place and what to expect." },
              { href: "/register", label: "Registration form", hint: "Sign up in about two minutes." },
              { href: "/draw", label: "The lucky draw", hint: "Watch it run, and see how it stays fair." },
              { href: "/winners", label: "Winners", hint: "Results from past events." },
              { href: "/rules", label: "Rules and fairness", hint: "Exactly how winners are chosen." },
              { href: "/privacy", label: "Privacy", hint: "What we collect, and what we never publish." },
            ].map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="flex h-full items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-leaf-400 hover:shadow-soft"
                >
                  <Compass className="mt-0.5 h-5 w-5 shrink-0 text-leaf-600" aria-hidden="true" />
                  <span>
                    <span className="block text-sm font-extrabold text-leaf-950">{link.label}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-slate-600">
                      {link.hint}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <p className="mt-8 flex items-center justify-center gap-2 text-center text-sm text-slate-500">
            <Search className="h-4 w-4" aria-hidden="true" />
            If a link on a poster brought you here, tell the organiser and they will send the current
            one.
          </p>
        </div>
      </section>
    </div>
  );
}
