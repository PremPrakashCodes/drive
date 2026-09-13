CREATE TYPE "space_lock_kind" AS ENUM('pin', 'password');--> statement-breakpoint
CREATE TABLE "space_locks" (
	"user_id" uuid,
	"organization_id" uuid,
	"kind" "space_lock_kind" NOT NULL,
	"secret_hash" text NOT NULL,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"retry_after" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "space_locks_pkey" PRIMARY KEY("user_id","organization_id")
);
--> statement-breakpoint
CREATE INDEX "space_locks_organization_id_idx" ON "space_locks" ("organization_id");--> statement-breakpoint
ALTER TABLE "space_locks" ADD CONSTRAINT "space_locks_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "space_locks" ADD CONSTRAINT "space_locks_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;