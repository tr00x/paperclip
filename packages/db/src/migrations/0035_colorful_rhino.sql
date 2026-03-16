ALTER TABLE "company_skills" ADD COLUMN "key" text;--> statement-breakpoint
UPDATE "company_skills"
SET "key" = CASE
  WHEN COALESCE("metadata"->>'sourceKind', '') = 'paperclip_bundled' THEN 'paperclipai/paperclip/' || "slug"
  WHEN (COALESCE("metadata"->>'sourceKind', '') = 'github' OR "source_type" = 'github')
    AND COALESCE("metadata"->>'owner', '') <> ''
    AND COALESCE("metadata"->>'repo', '') <> ''
    THEN lower("metadata"->>'owner') || '/' || lower("metadata"->>'repo') || '/' || "slug"
  WHEN COALESCE("metadata"->>'sourceKind', '') = 'managed_local' THEN 'company/' || "company_id"::text || '/' || "slug"
  WHEN (COALESCE("metadata"->>'sourceKind', '') = 'url' OR "source_type" = 'url')
    THEN 'url/'
      || COALESCE(
        NULLIF(regexp_replace(lower(regexp_replace(COALESCE("source_locator", ''), '^https?://([^/]+).*$','\1')), '[^a-z0-9._-]+', '-', 'g'), ''),
        'unknown'
      )
      || '/'
      || substr(md5(COALESCE("source_locator", "slug")), 1, 10)
      || '/'
      || "slug"
  WHEN "source_type" = 'local_path' AND COALESCE("source_locator", '') <> ''
    THEN 'local/' || substr(md5("source_locator"), 1, 10) || '/' || "slug"
  ELSE 'company/' || "company_id"::text || '/' || "slug"
END
WHERE "key" IS NULL;--> statement-breakpoint
ALTER TABLE "company_skills" ALTER COLUMN "key" SET NOT NULL;--> statement-breakpoint
DROP INDEX IF EXISTS "company_skills_company_slug_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "company_skills_company_key_idx" ON "company_skills" USING btree ("company_id","key");
