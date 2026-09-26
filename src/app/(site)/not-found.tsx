import { NotFoundBody } from "@/components/site/not-found-body";

/**
 * 404 for a `notFound()` call from inside a public page — an unpublished event
 * at `/event/[slug]`, for example. This boundary sits under the `(site)`
 * layout, so the navbar, footer and demo banner are still present.
 */
export default function SiteNotFound() {
  return <NotFoundBody />;
}
