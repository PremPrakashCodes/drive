CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"member_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"team_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"membership_key" text,
	"created_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "active_team_id" uuid;--> statement-breakpoint
ALTER TABLE "invitations" ADD COLUMN "team_id" uuid;--> statement-breakpoint
CREATE INDEX "sessions_active_team_id_idx" ON "sessions" ("active_team_id");--> statement-breakpoint
CREATE INDEX "invitations_team_id_idx" ON "invitations" ("team_id");--> statement-breakpoint
CREATE INDEX "teams_organization_id_idx" ON "teams" ("organization_id");--> statement-breakpoint
CREATE INDEX "team_members_team_id_idx" ON "team_members" ("team_id");--> statement-breakpoint
CREATE INDEX "team_members_user_id_idx" ON "team_members" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "team_members_membership_key_idx" ON "team_members" ("membership_key");--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_active_team_id_teams_id_fkey" FOREIGN KEY ("active_team_id") REFERENCES "teams"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_team_id_teams_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_teams_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;