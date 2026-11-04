CREATE TABLE "flow_events" (
    "id" UUID NOT NULL,
    "flow_id" UUID NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'external',
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "active_flow_session_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "flow_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "flow_events_flow_id_created_at_idx" ON "flow_events"("flow_id", "created_at");

ALTER TABLE "flow_events" ADD CONSTRAINT "flow_events_flow_id_fkey" FOREIGN KEY ("flow_id") REFERENCES "flows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
