CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "handle" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "avatar_icon" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "profiles_handle_key" ON "profiles"("handle");

ALTER TABLE "folders" ADD COLUMN "profile_id" UUID;
CREATE INDEX "folders_profile_id_idx" ON "folders"("profile_id");
ALTER TABLE "folders" ADD CONSTRAINT "folders_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "flows" ADD COLUMN "profile_id" UUID;
CREATE INDEX "flows_profile_id_idx" ON "flows"("profile_id");
ALTER TABLE "flows" ADD CONSTRAINT "flows_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
