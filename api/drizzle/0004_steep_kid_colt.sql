CREATE TYPE "public"."source_file_status" AS ENUM('uploaded', 'imported');--> statement-breakpoint
CREATE TYPE "public"."source_type" AS ENUM('manual', 'file');--> statement-breakpoint
CREATE TABLE "source_files" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "source_files_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"original_name" text NOT NULL,
	"storage_path" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" bigint NOT NULL,
	"status" "source_file_status" DEFAULT 'uploaded' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_source_files" (
	"user_id" bigint NOT NULL,
	"source_file_id" bigint NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_source_files_pk" PRIMARY KEY("user_id","source_file_id")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "source_type" "source_type" DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_source_files" ADD CONSTRAINT "user_source_files_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_source_files" ADD CONSTRAINT "user_source_files_source_file_id_source_files_id_fk" FOREIGN KEY ("source_file_id") REFERENCES "public"."source_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_source_files_source_file_id_idx" ON "user_source_files" USING btree ("source_file_id");