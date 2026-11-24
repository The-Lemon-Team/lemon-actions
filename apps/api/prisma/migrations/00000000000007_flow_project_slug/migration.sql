ALTER TABLE "flows" ADD COLUMN IF NOT EXISTS "project_slug" TEXT;
CREATE INDEX IF NOT EXISTS "flows_project_slug_idx" ON "flows"("project_slug");
