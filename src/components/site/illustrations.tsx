/**
 * Hand-built SVG artwork.
 *
 * Deliberately abstract and geometric rather than stock photography: it keeps
 * the page fast, on-brand, and free of third-party licensing questions.
 */

/**
 * Clamps a computed coordinate to hundredths.
 *
 * `Math.cos` and `Math.sin` are transcendental functions, which IEEE-754 does
 * not require to be correctly rounded, so Node's V8 and the browser's V8 can
 * return values that differ in their last bit. Fed straight into an SVG
 * attribute that becomes a real hydration mismatch: the server writes
 * `cx="90.83657091333114"` while the client writes `90.83657091333117`.
 * Rounding to two decimals is far below a visible pixel and absorbs the
 * difference, so both sides serialise to the same string.
 */
function fixed(n: number): number {
  return Math.round(n * 100) / 100;
}

export function HeroArt({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 520 520"
      className={className}
      role="img"
      aria-label="Illustration of students working together on environmental activities"
    >
      <defs>
        <linearGradient id="hero-sky" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#dcfce7" />
          <stop offset="55%" stopColor="#e0f2fe" />
          <stop offset="100%" stopColor="#fef3c7" />
        </linearGradient>
        <linearGradient id="hero-leaf" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#22c55e" />
          <stop offset="100%" stopColor="#14532d" />
        </linearGradient>
        <linearGradient id="hero-leaf2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#86efac" />
          <stop offset="100%" stopColor="#16a34a" />
        </linearGradient>
        <linearGradient id="hero-earth" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>
      </defs>

      {/* backdrop */}
      <circle cx="260" cy="268" r="196" fill="url(#hero-sky)" />
      <circle cx="260" cy="268" r="196" fill="none" stroke="#166534" strokeOpacity=".12" strokeWidth="2" />
      <g opacity=".5">
        {Array.from({ length: 26 }).map((_, i) => {
          const angle = (i / 26) * Math.PI * 2;
          return (
            <circle
              key={i}
              cx={fixed(260 + Math.cos(angle) * 226)}
              cy={fixed(268 + Math.sin(angle) * 226)}
              r={i % 3 === 0 ? 4 : 2.2}
              fill="#16a34a"
              opacity=".35"
            />
          );
        })}
      </g>

      {/* earth + hands */}
      <g>
        <circle cx="262" cy="176" r="66" fill="url(#hero-earth)" />
        <path
          d="M214 150c22-10 40 4 56 2s22-16 30-22c-4 26-16 46-38 56-20 9-38 4-48-6z"
          fill="#bbf7d0"
          opacity=".95"
        />
        <path d="M206 196c30 10 62 8 92-4-12 26-38 40-64 34-16-4-26-16-28-30z" fill="#86efac" opacity=".9" />
      </g>

      {/* big leaf pair */}
      <g transform="translate(150 250) rotate(-18)">
        <path d="M0 0c0-42 30-72 74-76 4 44-24 78-74 76z" fill="url(#hero-leaf)" />
        <path d="M6 -4c22-6 40-22 52-44" stroke="#ecfdf5" strokeWidth="4" strokeLinecap="round" fill="none" opacity=".8" />
      </g>
      <g transform="translate(196 322) rotate(12)">
        <path d="M0 0c0-34 24-58 60-62 3 36-20 63-60 62z" fill="url(#hero-leaf2)" />
        <path d="M5-4c18-5 32-18 42-36" stroke="#f0fdf4" strokeWidth="3.5" strokeLinecap="round" fill="none" opacity=".85" />
      </g>

      {/* sprout in cupped hands */}
      <g transform="translate(330 300)">
        <path d="M-52 44c14 18 34 26 52 26s38-8 52-26c-14 30-34 42-52 42s-38-12-52-42z" fill="#166534" opacity=".9" />
        <rect x="-3" y="-30" width="6" height="60" rx="3" fill="#14532d" />
        <path d="M0-30c-2-20 10-34 28-38 2 20-10 34-28 38z" fill="#22c55e" />
        <path d="M0-30c2-18-9-31-26-35-2 18 9 31 26 35z" fill="#4ade80" />
      </g>

      {/* abstract students */}
      <g>
        <g transform="translate(96 330)">
          <circle cx="0" cy="0" r="20" fill="#f59e0b" />
          <path d="M-28 66c0-18 12-30 28-30s28 12 28 30z" fill="#f59e0b" />
        </g>
        <g transform="translate(150 350)">
          <circle cx="0" cy="0" r="18" fill="#0284c7" />
          <path d="M-25 60c0-16 11-27 25-27s25 11 25 27z" fill="#0284c7" />
        </g>
        <g transform="translate(404 342)">
          <circle cx="0" cy="0" r="19" fill="#16a34a" />
          <path d="M-27 64c0-17 12-29 27-29s27 12 27 29z" fill="#16a34a" />
        </g>
        <g transform="translate(456 368)">
          <circle cx="0" cy="0" r="16" fill="#7c3aed" />
          <path d="M-22 54c0-15 10-25 22-25s22 10 22 25z" fill="#7c3aed" />
        </g>
      </g>

      {/* recycle arrows badge */}
      <g transform="translate(392 128)">
        <circle cx="0" cy="0" r="42" fill="#ffffff" />
        <circle cx="0" cy="0" r="42" fill="none" stroke="#16a34a" strokeWidth="3" />
        <g fill="#16a34a" transform="translate(-24 -24)">
          <path d="M6 4l7 7-7 7-3-3 4-4-4-4z" />
          <path d="M26 10l7 7-7 7-3-3 4-4-4-4z" transform="rotate(120 29.5 17)" />
          <path d="M26 10l7 7-7 7-3-3 4-4-4-4z" transform="rotate(240 29.5 17)" />
        </g>
      </g>
    </svg>
  );
}

/** Compact decorative leaf used as a section flourish. */
export function LeafDivider({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 24" className={className} aria-hidden="true" preserveAspectRatio="none">
      <path d="M0 12h92" stroke="#16a34a" strokeOpacity=".35" strokeWidth="2" strokeLinecap="round" />
      <path d="M148 12h92" stroke="#16a34a" strokeOpacity=".35" strokeWidth="2" strokeLinecap="round" />
      <g transform="translate(120 12)">
        <path d="M0 0c-2-12 6-20 18-22 2 12-6 20-18 22z" fill="#16a34a" />
        <path d="M0 0c2-11-5-19-16-21-2 11 5 19 16 21z" fill="#4ade80" />
        <rect x="-1.5" y="-2" width="3" height="14" rx="1.5" fill="#14532d" />
      </g>
    </svg>
  );
}

/** Poster-style artwork for the closing section. */
export function ImpactArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 300" className={className} role="img" aria-label="Students taking part in a campus clean-up">
      <rect width="400" height="300" rx="28" fill="#f0fdf4" />
      <g opacity=".6">
        {Array.from({ length: 7 }).map((_, row) =>
          Array.from({ length: 9 }).map((_, col) => (
            <circle key={`${row}-${col}`} cx={28 + col * 43} cy={30 + row * 38} r="2" fill="#86efac" />
          )),
        )}
      </g>
      <path d="M0 236c60-8 110 6 168 2s150-22 232-8v70H0z" fill="#bbf7d0" />
      <g transform="translate(60 150)">
        <circle cx="0" cy="0" r="17" fill="#0284c7" />
        <path d="M-24 56c0-16 11-27 24-27s24 11 24 27z" fill="#0284c7" />
        <rect x="20" y="18" width="5" height="56" rx="2.5" fill="#166534" transform="rotate(18 22 46)" />
        <path d="M42 74h16l-4 8H46z" fill="#166534" />
      </g>
      <g transform="translate(160 176)">
        <circle cx="0" cy="0" r="15" fill="#f59e0b" />
        <path d="M-21 48c0-14 9-24 21-24s21 10 21 24z" fill="#f59e0b" />
        <rect x="18" y="14" width="5" height="48" rx="2.5" fill="#166534" transform="rotate(-16 20 38)" />
      </g>
      <g transform="translate(262 158)">
        <circle cx="0" cy="0" r="16" fill="#16a34a" />
        <path d="M-22 52c0-15 10-26 22-26s22 11 22 26z" fill="#16a34a" />
        <rect x="-22" y="16" width="5" height="46" rx="2.5" fill="#166534" transform="rotate(-20 -20 40)" />
      </g>
      <g transform="translate(330 120)">
        <path d="M0 0c0-26 18-44 44-46 2 26-14 46-44 46z" fill="#22c55e" />
        <path d="M4-4c14-4 25-13 32-27" stroke="#ecfdf5" strokeWidth="3" strokeLinecap="round" fill="none" />
      </g>
    </svg>
  );
}
