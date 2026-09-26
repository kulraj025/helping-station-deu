import { NotFoundBody } from "@/components/site/not-found-body";

/**
 * 404 for a URL that matches no route in the `(site)` group.
 *
 * A bare unmatched URL is caught here, at the root, so this page renders
 * inside the root layout only — there is no navbar above it. `NotFoundBody`
 * therefore has to stand on its own, which is why it is a plain presentational
 * component rather than something that assumes the site chrome exists.
 */
export default function NotFound() {
  return <NotFoundBody />;
}
