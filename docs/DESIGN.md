# Design system

How the visual language is built, and how dark mode works.

## The palette

Colours live as CSS custom properties in the `@theme` block at the top of
[`src/app/globals.css`](../src/app/globals.css). There is no JavaScript config file — Tailwind 4
reads its theme from CSS.

| Ramp | Role |
| --- | --- |
| `leaf-50` … `leaf-950` | Brand green. Buttons, headings, rules, and the dark panels. |
| `azure-50` … `azure-700` | Sky accent, used sparingly for informational states. |
| `gold-300` … `gold-600` | Warm accent for badges, prizes and highlights. |
| `canvas` | Page background. One step off white, so cards can sit above it. |
| `slate-*`, `white` | Neutrals: surfaces, borders, body copy. |

Plus a few semantic additions: `--shadow-soft` / `--shadow-lift` / `--shadow-glow`, `--radius-4xl`,
the `--animate-*` keyframes, and the font stacks.

## Dark mode

**Dark mode is a palette remap, not a set of `dark:` variants.** Adding a `.dark` class to `<html>`
flips the entire site without touching a single component.

That works because every colour utility in Tailwind 4 compiles to a custom property:

```css
.bg-white  { background-color: var(--color-white) }
.text-slate-600 { color: var(--color-slate-600) }
```

So remapping `--color-white` under a `.dark` scope moves all 100 uses of `bg-white` at once. The
practical consequence: **dark mode cannot regress by forgetting a component**, which is the usual
failure mode of the `dark:`-variant approach.

### The one deliberate exception: Google sign-in

The Google button in [`src/components/ui/google-button.tsx`](../src/components/ui/google-button.tsx)
keeps its white background, hairline border and near-black label in **both** themes. That is not an
oversight.

Google publishes hard rules for the sign-in button, and recolouring it to match a site is a documented
reason an OAuth consent screen gets rejected. Following the palette here would have looked more
consistent and been less correct. The mark is the four-colour **G**; the `Chrome` icon from lucide
that it replaced is the browser logo, so a sign-in button wearing it reads as "open in browser".

### Why not `dark:` variants everywhere

There are roughly 400 colour utilities across the components. Expressing dark mode as `dark:` classes
on each one would be a large, easy-to-break diff, and every future component would have to remember
to handle it. The remap makes the dark theme the *default* behaviour and keeps light mode as the
override.

### How a theme is chosen and applied

`src/app/layout.tsx` renders a small inline script in `<head>` that reads `localStorage.theme` and
falls back to `prefers-color-scheme`, then adds `.dark` to `<html>`. It has to be inline and
synchronous: a React effect runs after the browser has already painted, which shows the user a flash
of the light theme. `<html>` carries `suppressHydrationWarning` because that script legitimately
mutates the class the server rendered.

`src/components/ui/theme-toggle.tsx` flips the class and writes the choice back to `localStorage`,
which makes it sticky. Until that first manual choice the toggle follows the operating system.

### Tokens that do double duty

A few tokens serve more than one role, which is the one subtlety in the remap. `white` backs both
`bg-white` (100 uses, a surface) and `text-white` (51 uses, ink on a dark green button). `leaf-100`
is a pale tint as a background and pale ink on a dark panel as text.

Where that happens, the token keeps the role it has in more places and the other role is **pinned**
by a rule that re-declares the variable on the elements that need it:

```css
.dark .bg-leaf-50    { --color-leaf-50: var(--brand-surface); }
.dark .text-leaf-700 { --color-leaf-700: var(--brand-ink); }
.dark .bg-leaf-950   { --color-leaf-950: var(--brand-panel); }
```

Pinning the *variable* rather than the `background-color` matters: Tailwind resolves alpha modifiers
through `color-mix(in oklab, var(--color-x) 70%, transparent)`, so one re-declaration also moves the
`/40`, `/60` and `/80` variants for free.

If you add a new combination of an existing token, check whether it needs a pin. The
[contrast audit](#checking-contrast) will tell you.

### Printing stays light

The whole dark block sits inside `@media screen`. Printing a participation card or a poster in dark
mode wastes ink and reads badly, so print always falls back to the light palette without needing a
separate print stylesheet.

## Checking contrast

Because the theme is CSS custom properties, neither TypeScript nor the unit tests can tell you that
a token resolved to an unreadable colour. `npm run audit:contrast` covers that gap:

```
npm run build && npm run audit:contrast
```

It resolves the cascade by hand — light value from `@theme` and the Tailwind defaults, then
`.dark { ... }`, then any pin rule whose selector matches the classes on the element — converts
`oklch` and `color-mix` results to sRGB, and checks the contrast of every text/background pair that
actually appears in a `className` in `src/`.

Pairings are read from real class strings and are variant-aware, so `text-leaf-700` in a resting
state is never checked against the `bg-leaf-600` that only appears under `group-hover:`. It reports
anything below WCAG AA (4.5:1) and exits non-zero; it runs in CI after the build.

The current state of the palette:

| Pairing | Ratio |
| --- | --- |
| Primary button label on `bg-leaf-700` | 4.79:1 |
| Heading (`text-leaf-950`) on the page | 16.65:1 |
| Body copy (`text-slate-500`) on the page | 8.64:1 |

## Component classes

A few hand-written classes in `@layer components` carry the brand look and are not a Tailwind
utility, so they need their own dark handling:

| Class | Purpose |
| --- | --- |
| `.container-page` | Centred page gutter. |
| `.card` | The standard raised surface. |
| `.card-glass` | Translucent blurred panel, used over the hero. |
| `.bg-canopy` | Soft radial green wash behind most public pages. |
| `.bg-dots`, `.bg-grid-lines` | Faint texture overlays. |
| `.text-gradient` | Green-to-sky gradient text. |
| `.skeleton` | Loading shimmer. |

Each of these hardcodes light values and has a `.dark` counterpart in the dark block at the bottom
of the stylesheet. If you add one, add its dark version too.

## Adding a colour

1. Add the shade to the `@theme` block.
2. Use the nearest existing ramp step rather than inventing a new one.
3. Run `npm run build && npm run audit:contrast`.
4. If the token is used as both a surface and ink, add a pin as described above.

## Password fields

[`src/components/ui/password-input.tsx`](../src/components/ui/password-input.tsx) owns password
entry, and three things about it are load-bearing:

- **A show/hide toggle.** People mistype passwords constantly on a phone, and a field that only ever
  renders dots gives them nothing to check against. The toggle is a real `<button>` rather than a CSS
  trick, so it is keyboard reachable and announced, and it carries `aria-pressed` to expose its state.
  It does not steal focus, and it does not change the input `type` while the field holds focus —
  flipping `type` mid-typing moves the caret to the end on some mobile browsers.
- **A checklist, not a strength bar.** The only rule is length, so the feedback says exactly one
  thing: whether the minimum is met. A coloured "strong/weak" bar has to guess, and a bar that turns
  red on somebody's reasonable passphrase is just noise. A checklist cannot be wrong.
- **A match hint on the second field**, shown only once something has been typed there.

The live regions are `aria-live="polite"`, which matters because the text updates on every keystroke
and an assertive region would talk over the person typing.
