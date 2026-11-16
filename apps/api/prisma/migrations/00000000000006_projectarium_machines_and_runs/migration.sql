-- AlterTable: Add machine binding columns to projectarium_apps
ALTER TABLE "projectarium_apps"
ADD COLUMN "machine_id" TEXT,
ADD COLUMN "machine_name" TEXT;

-- CreateIndex
CREATE INDEX "projectarium_apps_machine_id_idx" ON "projectarium_apps"("machine_id");

-- CreateTable: Persistent append-only telemetry for application runs across machines (PC-1, PC-2, Prod)
CREATE TABLE "projectarium_app_runs" (
    "id" TEXT NOT NULL,
    "stand_id" TEXT NOT NULL,
    "stand_slug" TEXT NOT NULL,
    "stand_name" TEXT NOT NULL,
    "app_name" TEXT NOT NULL,
    "host" TEXT NOT NULL DEFAULT 'localhost',
    "port" INTEGER NOT NULL,
    "instance_id" TEXT NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'dev',
    "network_mode" TEXT NOT NULL DEFAULT 'local',
    "machine_id" TEXT NOT NULL DEFAULT 'unknown',
    "machine_name" TEXT NOT NULL DEFAULT 'unknown',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_heartbeat_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "duration_sec" INTEGER,
    "end_reason" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "projectarium_app_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "projectarium_app_runs_instance_id_key" ON "projectarium_app_runs"("instance_id");

-- CreateIndex
CREATE INDEX "projectarium_app_runs_stand_id_started_at_idx" ON "projectarium_app_runs"("stand_id", "started_at");

-- CreateIndex
CREATE INDEX "projectarium_app_runs_machine_id_started_at_idx" ON "projectarium_app_runs"("machine_id", "started_at");

-- CreateIndex
CREATE INDEX "projectarium_app_runs_end_reason_started_at_idx" ON "projectarium_app_runs"("end_reason", "started_at");
