-- Site-wide section switches. A single row, created on first read by
-- getSiteSettings(), so there is no seed step and a fresh database is open.
CREATE TABLE "SiteSettings" (
    "id"         INTEGER NOT NULL DEFAULT 1,
    "siteOpen"   BOOLEAN NOT NULL DEFAULT true,
    "registerOpen" BOOLEAN NOT NULL DEFAULT true,
    "winnersOpen"  BOOLEAN NOT NULL DEFAULT true,
    "drawOpen"     BOOLEAN NOT NULL DEFAULT true,
    "rulesOpen"    BOOLEAN NOT NULL DEFAULT true,
    "showCount"    BOOLEAN NOT NULL DEFAULT true,
    "closedNote"   TEXT NOT NULL DEFAULT '',
    "updatedBy"    TEXT,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSettings_pkey" PRIMARY KEY ("id")
);

-- The table is a singleton; this makes that a database-level guarantee rather
-- than a convention, so a bug cannot end up with two competing rows.
CREATE UNIQUE INDEX "SiteSettings_singleton_key" ON "SiteSettings" ((true));
