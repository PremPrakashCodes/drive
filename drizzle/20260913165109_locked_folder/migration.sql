ALTER TABLE "drive_items" ADD COLUMN "locked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "space_locks" DROP COLUMN "kind";--> statement-breakpoint
DROP TYPE "space_lock_kind";