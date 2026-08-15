ALTER TABLE "users" DROP CONSTRAINT "users_code_unique";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "users_code_active_unique" ON "users" USING btree ("code") WHERE "users"."deleted_at" IS NULL;