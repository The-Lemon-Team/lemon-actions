-- CreateTable
CREATE TABLE "projectarium_stands" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "neuron_workspace" TEXT NOT NULL,
    "project_token" TEXT NOT NULL,
    "context" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projectarium_stands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projectarium_apps" (
    "id" TEXT NOT NULL,
    "stand_id" TEXT NOT NULL,
    "app_name" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "instance_id" TEXT NOT NULL,
    "lease_token" TEXT NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'dev',
    "network_mode" TEXT NOT NULL DEFAULT 'local',
    "status" TEXT NOT NULL DEFAULT 'ONLINE',
    "health_url" TEXT,
    "last_ping_at" TIMESTAMP(3),
    "ping_latency_ms" INTEGER,
    "consecutive_failures" INTEGER NOT NULL DEFAULT 0,
    "registered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "projectarium_apps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projectarium_todos" (
    "id" TEXT NOT NULL,
    "stand_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT NOT NULL DEFAULT 'PROJECT',
    "target_app_name" TEXT,
    "author" TEXT NOT NULL DEFAULT 'developer',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "projectarium_todos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projectarium_events" (
    "id" TEXT NOT NULL,
    "stand_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'PROJECT',
    "target_app_name" TEXT,
    "description" TEXT NOT NULL,
    "author" TEXT NOT NULL DEFAULT 'system',
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "projectarium_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "projectarium_stands_slug_key" ON "projectarium_stands"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "projectarium_stands_project_token_key" ON "projectarium_stands"("project_token");

-- CreateIndex
CREATE UNIQUE INDEX "projectarium_apps_instance_id_key" ON "projectarium_apps"("instance_id");

-- CreateIndex
CREATE INDEX "projectarium_apps_stand_id_idx" ON "projectarium_apps"("stand_id");

-- CreateIndex
CREATE INDEX "projectarium_todos_stand_id_idx" ON "projectarium_todos"("stand_id");

-- CreateIndex
CREATE INDEX "projectarium_events_stand_id_timestamp_idx" ON "projectarium_events"("stand_id", "timestamp");

-- AddForeignKey
ALTER TABLE "projectarium_apps" ADD CONSTRAINT "projectarium_apps_stand_id_fkey" FOREIGN KEY ("stand_id") REFERENCES "projectarium_stands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projectarium_todos" ADD CONSTRAINT "projectarium_todos_stand_id_fkey" FOREIGN KEY ("stand_id") REFERENCES "projectarium_stands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projectarium_events" ADD CONSTRAINT "projectarium_events_stand_id_fkey" FOREIGN KEY ("stand_id") REFERENCES "projectarium_stands"("id") ON DELETE CASCADE ON UPDATE CASCADE;
