import { getCurrentUser } from "@/lib/auth-helpers";
import { env } from "@/lib/env";
import { SiteNavbar } from "@/components/site/navbar";
import { SiteFooter } from "@/components/site/footer";
import { DemoBanner } from "@/components/site/demo-banner";

/** Chrome for every public page. */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-dvh flex-col">
      {env.demoMode ? <DemoBanner /> : null}
      <SiteNavbar role={user?.role ?? null} name={user?.name} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
