CREATE TABLE "drive_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organization_id" uuid NOT NULL,
	"parent_id" uuid,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"size" bigint DEFAULT 0 NOT NULL,
	"mime_type" text,
	"storage_key" text,
	"visibility" text DEFAULT 'shared' NOT NULL,
	"color" text,
	"created_by_id" uuid NOT NULL,
	"trashed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "drive_items_visibility_check" CHECK ("visibility" in ('shared', 'private'))
);
--> statement-breakpoint
CREATE TABLE "drive_stars" (
	"user_id" uuid,
	"item_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "drive_stars_pkey" PRIMARY KEY("user_id","item_id")
);
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "kind" text DEFAULT 'organization' NOT NULL;--> statement-breakpoint
CREATE INDEX "drive_items_organization_parent_idx" ON "drive_items" ("organization_id","parent_id");--> statement-breakpoint
CREATE INDEX "drive_items_parent_id_idx" ON "drive_items" ("parent_id");--> statement-breakpoint
CREATE INDEX "drive_items_created_by_id_idx" ON "drive_items" ("created_by_id");--> statement-breakpoint
CREATE INDEX "drive_stars_item_id_idx" ON "drive_stars" ("item_id");--> statement-breakpoint
ALTER TABLE "drive_items" ADD CONSTRAINT "drive_items_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "drive_items" ADD CONSTRAINT "drive_items_parent_id_drive_items_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "drive_items"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "drive_items" ADD CONSTRAINT "drive_items_created_by_id_users_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "drive_stars" ADD CONSTRAINT "drive_stars_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "drive_stars" ADD CONSTRAINT "drive_stars_item_id_drive_items_id_fkey" FOREIGN KEY ("item_id") REFERENCES "drive_items"("id") ON DELETE CASCADE;