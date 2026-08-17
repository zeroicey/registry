CREATE TABLE "collection_members" (
	"collection_id" bigint NOT NULL,
	"user_id" bigint NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_members_pk" PRIMARY KEY("collection_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "collections_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"description" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "attributes_key_active_unique";--> statement-breakpoint
ALTER TABLE "attributes" ADD COLUMN "collection_id" bigint;--> statement-breakpoint
ALTER TABLE "source_files" ADD COLUMN "collection_id" bigint;--> statement-breakpoint
ALTER TABLE "collection_members" ADD CONSTRAINT "collection_members_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_members" ADD CONSTRAINT "collection_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "collection_members_user_id_idx" ON "collection_members" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "attributes" ADD CONSTRAINT "attributes_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_files" ADD CONSTRAINT "source_files_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "attributes_global_key_active_unique" ON "attributes" USING btree ("key") WHERE "attributes"."collection_id" IS NULL AND "attributes"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "attributes_collection_key_active_unique" ON "attributes" USING btree ("collection_id","key") WHERE "attributes"."collection_id" IS NOT NULL AND "attributes"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "attributes_collection_id_idx" ON "attributes" USING btree ("collection_id");--> statement-breakpoint
CREATE INDEX "source_files_collection_id_idx" ON "source_files" USING btree ("collection_id");