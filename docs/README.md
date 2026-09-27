# Documentation

Focused guides for the things that are easy to get wrong. The [root README](../README.md) covers
what the app does and why; these files cover how to operate it.

| Document | Read it when |
| --- | --- |
| [`DEPLOYMENT.md`](DEPLOYMENT.md) | You are putting this on the internet. Start here. |
| [`AUTH.md`](AUTH.md) | You are wiring up Google sign-in, or debugging a redirect loop. |
| [`OPERATIONS.md`](OPERATIONS.md) | It is live and you need to know what to check, and what to do when something breaks. |
| [`DATABASE.md`](DATABASE.md) | You are changing the Prisma schema, or seeding, or recovering data. |
| [`DESIGN.md`](DESIGN.md) | You are changing colours, adding a component, or working on dark mode. |

## The short version

If you only read one thing, read [`DEPLOYMENT.md`](DEPLOYMENT.md). The two mistakes that cost the
most time are setting `NEXT_PUBLIC_APP_URL` to localhost in production, and deploying code that
queries a column before the migration that adds it has run.

## A note on this repository

`README.md` at the root is the public-facing document and is written for someone evaluating the
project. The files here are operational: checklists, failure modes, and the specific error messages
you are likely to paste into a search box.
