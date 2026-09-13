CREATE TYPE "drive_item_kind" AS ENUM('folder', 'pdf', 'image', 'video', 'code', 'document', 'spreadsheet', 'archive', 'audio');--> statement-breakpoint
CREATE TYPE "drive_item_visibility" AS ENUM('shared', 'private');--> statement-breakpoint
CREATE TYPE "workspace_kind" AS ENUM('personal', 'organization');--> statement-breakpoint
ALTER TABLE "drive_items" DROP CONSTRAINT "drive_items_visibility_check";--> statement-breakpoint
ALTER TABLE "organizations" ALTER COLUMN "kind" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "organizations" ALTER COLUMN "kind" SET DATA TYPE "workspace_kind" USING "kind"::"workspace_kind";--> statement-breakpoint
ALTER TABLE "organizations" ALTER COLUMN "kind" SET DEFAULT 'organization'::"workspace_kind";--> statement-breakpoint
ALTER TABLE "drive_items" ALTER COLUMN "kind" SET DATA TYPE "drive_item_kind" USING "kind"::"drive_item_kind";--> statement-breakpoint
ALTER TABLE "drive_items" ALTER COLUMN "visibility" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "drive_items" ALTER COLUMN "visibility" SET DATA TYPE "drive_item_visibility" USING "visibility"::"drive_item_visibility";--> statement-breakpoint
ALTER TABLE "drive_items" ALTER COLUMN "visibility" SET DEFAULT 'shared'::"drive_item_visibility";