CREATE EXTENSION IF NOT EXISTS "ltree";

CREATE TYPE "FlowType" AS ENUM ('CONTEXT', 'MUTEX', 'OBSERVER', 'FSM', 'TIMER');
CREATE TYPE "FlowStatus" AS ENUM ('INACTIVE', 'ACTIVE', 'PAUSED', 'PROCESSING');
CREATE TYPE "ActionType" AS ENUM ('FSM', 'SLA', 'TIMER', 'COUNTER');

CREATE TABLE "folders" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "parent_id" UUID,
    "path" ltree NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "folders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tags" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "color_hex" TEXT,
    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "flows" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "FlowType" NOT NULL,
    "status" "FlowStatus" NOT NULL DEFAULT 'INACTIVE',
    "is_exclusive" BOOLEAN NOT NULL DEFAULT false,
    "folder_id" UUID,
    "config" JSONB,
    "orchestrator_rules" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "flows_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "flow_tags" (
    "flow_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,
    CONSTRAINT "flow_tags_pkey" PRIMARY KEY ("flow_id", "tag_id")
);

CREATE TABLE "flow_sessions" (
    "id" UUID NOT NULL,
    "flow_id" UUID NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "closed_by" TEXT,
    CONSTRAINT "flow_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cards" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cards_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "actions" (
    "id" UUID NOT NULL,
    "card_id" UUID NOT NULL,
    "type" "ActionType" NOT NULL,
    "current_state" TEXT,
    "config" JSONB,
    CONSTRAINT "actions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "action_events" (
    "id" UUID NOT NULL,
    "action_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "active_flow_session_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    CONSTRAINT "action_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "card_flow_subscriptions" (
    "card_id" UUID NOT NULL,
    "flow_id" UUID NOT NULL,
    "required_status" "FlowStatus" NOT NULL DEFAULT 'ACTIVE',
    "on_match_behavior" TEXT NOT NULL DEFAULT 'NOTIFY',
    CONSTRAINT "card_flow_subscriptions_pkey" PRIMARY KEY ("card_id", "flow_id")
);

CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");
CREATE INDEX "folders_parent_id_idx" ON "folders"("parent_id");
CREATE INDEX "flows_folder_id_idx" ON "flows"("folder_id");
CREATE INDEX "flows_type_idx" ON "flows"("type");
CREATE INDEX "flows_status_idx" ON "flows"("status");
CREATE INDEX "flow_sessions_flow_id_ended_at_idx" ON "flow_sessions"("flow_id", "ended_at");
CREATE INDEX "actions_card_id_idx" ON "actions"("card_id");
CREATE INDEX "action_events_action_id_created_at_idx" ON "action_events"("action_id", "created_at");

ALTER TABLE "folders" ADD CONSTRAINT "folders_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "folders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "flows" ADD CONSTRAINT "flows_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "flow_tags" ADD CONSTRAINT "flow_tags_flow_id_fkey" FOREIGN KEY ("flow_id") REFERENCES "flows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "flow_tags" ADD CONSTRAINT "flow_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "flow_sessions" ADD CONSTRAINT "flow_sessions_flow_id_fkey" FOREIGN KEY ("flow_id") REFERENCES "flows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "actions" ADD CONSTRAINT "actions_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "action_events" ADD CONSTRAINT "action_events_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "actions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "card_flow_subscriptions" ADD CONSTRAINT "card_flow_subscriptions_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "card_flow_subscriptions" ADD CONSTRAINT "card_flow_subscriptions_flow_id_fkey" FOREIGN KEY ("flow_id") REFERENCES "flows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
