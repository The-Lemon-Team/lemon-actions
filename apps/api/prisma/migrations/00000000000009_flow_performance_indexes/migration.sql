-- Ensure flow_buffer_items table exists (added to schema.prisma for BATCH flows)
CREATE TABLE IF NOT EXISTS "flow_buffer_items" (
    "id" UUID NOT NULL,
    "flow_id" UUID NOT NULL,
    "dedup_key" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "enqueued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "flushed_at" TIMESTAMP(3),

    CONSTRAINT "flow_buffer_items_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
    ALTER TABLE "flow_buffer_items"
        ADD CONSTRAINT "flow_buffer_items_flow_id_fkey"
        FOREIGN KEY ("flow_id") REFERENCES "flows"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "flow_buffer_items_flow_id_flushed_at_idx" ON "flow_buffer_items"("flow_id", "flushed_at");
CREATE INDEX IF NOT EXISTS "flow_buffer_items_flow_id_dedup_key_idx" ON "flow_buffer_items"("flow_id", "dedup_key");

-- Performance indexes for hot-path flow scheduling, mutex locking, observer lookup, and session queries
CREATE INDEX IF NOT EXISTS "flows_type_status_idx" ON "flows"("type", "status");
CREATE INDEX IF NOT EXISTS "flows_folder_exclusive_status_idx" ON "flows"("folder_id", "is_exclusive", "status");
CREATE INDEX IF NOT EXISTS "flow_events_active_sessions_gin_idx" ON "flow_events" USING GIN ("active_flow_session_ids");
CREATE INDEX IF NOT EXISTS "flow_sessions_open_flow_idx" ON "flow_sessions"("flow_id") WHERE "ended_at" IS NULL;
CREATE INDEX IF NOT EXISTS "flow_buffer_items_pending_dedup_idx" ON "flow_buffer_items"("flow_id", "dedup_key") WHERE "flushed_at" IS NULL;
