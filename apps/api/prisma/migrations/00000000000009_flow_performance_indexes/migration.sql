-- Performance indexes for hot-path flow scheduling, mutex locking, observer lookup, and session queries
CREATE INDEX IF NOT EXISTS "flows_type_status_idx" ON "flows"("type", "status");
CREATE INDEX IF NOT EXISTS "flows_folder_exclusive_status_idx" ON "flows"("folder_id", "is_exclusive", "status");
CREATE INDEX IF NOT EXISTS "flow_events_active_sessions_gin_idx" ON "flow_events" USING GIN ("active_flow_session_ids");
CREATE INDEX IF NOT EXISTS "flow_sessions_open_flow_idx" ON "flow_sessions"("flow_id") WHERE "ended_at" IS NULL;
CREATE INDEX IF NOT EXISTS "flow_buffer_items_pending_dedup_idx" ON "flow_buffer_items"("flow_id", "dedup_key") WHERE "flushed_at" IS NULL;
