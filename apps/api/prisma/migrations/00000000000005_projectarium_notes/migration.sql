-- CreateTable
CREATE TABLE "projectarium_notes" (
    "id" TEXT NOT NULL,
    "stand_id" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "author" TEXT NOT NULL DEFAULT 'developer',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "projectarium_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "projectarium_notes_stand_id_updated_at_idx" ON "projectarium_notes"("stand_id", "updated_at");

-- AddForeignKey
ALTER TABLE "projectarium_notes" ADD CONSTRAINT "projectarium_notes_stand_id_fkey" FOREIGN KEY ("stand_id") REFERENCES "projectarium_stands"("id") ON DELETE CASCADE ON UPDATE CASCADE;
