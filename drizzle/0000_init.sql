CREATE TYPE "public"."application_channel" AS ENUM('company_site', 'easy_apply', 'email', 'referral', 'talent_network', 'recruiter_inbound', 'direct_message', 'other');--> statement-breakpoint
CREATE TYPE "public"."application_event_type" AS ENUM('applied', 'recruiter_reply', 'screen', 'technical_interview', 'take_home', 'final_interview', 'offer', 'accepted', 'rejected', 'withdrawn', 'follow_up', 'note');--> statement-breakpoint
CREATE TYPE "public"."application_status" AS ENUM('applied', 'screening', 'interviewing', 'offer', 'accepted', 'rejected', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."company_kind" AS ENUM('unknown', 'employer', 'agency', 'talent_network');--> statement-breakpoint
CREATE TYPE "public"."eligibility_check" AS ENUM('confirmed_open', 'restricted', 'unclear');--> statement-breakpoint
CREATE TYPE "public"."eligibility" AS ENUM('open', 'likely', 'unknown', 'possible', 'restricted');--> statement-breakpoint
CREATE TYPE "public"."fetch_trigger" AS ENUM('manual', 'cron', 'cli');--> statement-breakpoint
CREATE TYPE "public"."job_category" AS ENUM('main', 'ai-training');--> statement-breakpoint
CREATE TYPE "public"."skip_reason" AS ENUM('wrong_stack', 'seniority', 'location_not_open', 'salary', 'company', 'duplicate', 'closed', 'other');--> statement-breakpoint
CREATE TABLE "application_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"type" "application_event_type" NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL,
	"channel" "application_channel" NOT NULL,
	"resume_version_id" uuid,
	"tailored" boolean DEFAULT false NOT NULL,
	"cover_letter" boolean DEFAULT false NOT NULL,
	"asked_rate" text,
	"status" "application_status" DEFAULT 'applied' NOT NULL,
	"eligibility_check" "eligibility_check",
	"notes" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "applications_jobId_unique" UNIQUE("job_id")
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"kind" "company_kind" DEFAULT 'unknown' NOT NULL,
	"hires_abroad" boolean,
	"website" text,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "companies_normalizedName_unique" UNIQUE("normalized_name")
);
--> statement-breakpoint
CREATE TABLE "fetch_run_sources" (
	"run_id" uuid NOT NULL,
	"source" text NOT NULL,
	"ok" boolean NOT NULL,
	"error" text,
	"fetched" integer DEFAULT 0 NOT NULL,
	"matched" integer DEFAULT 0 NOT NULL,
	"rejected" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "fetch_run_sources_run_id_source_pk" PRIMARY KEY("run_id","source")
);
--> statement-breakpoint
CREATE TABLE "fetch_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trigger" "fetch_trigger" NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"duration_ms" integer,
	"max_age_hours" integer,
	"fetched" integer DEFAULT 0 NOT NULL,
	"matched" integer DEFAULT 0 NOT NULL,
	"added" integer DEFAULT 0 NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "job_sightings" (
	"job_id" uuid NOT NULL,
	"source" text NOT NULL,
	"source_job_id" text NOT NULL,
	"url" text NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_sightings_job_id_source_pk" PRIMARY KEY("job_id","source")
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dedupe_key" text NOT NULL,
	"company_id" uuid NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"source" text NOT NULL,
	"locations" text[] DEFAULT '{}'::text[] NOT NULL,
	"eligibility" "eligibility" NOT NULL,
	"eligibility_reason" text DEFAULT '' NOT NULL,
	"category" "job_category" DEFAULT 'main' NOT NULL,
	"score" smallint DEFAULT 0 NOT NULL,
	"matched_skills" text[] DEFAULT '{}'::text[] NOT NULL,
	"salary_min" integer,
	"salary_max" integer,
	"salary_period" text,
	"salary_currency" text,
	"employment_type" text,
	"description" text DEFAULT '' NOT NULL,
	"posted_at" timestamp with time zone,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"added_manually" boolean DEFAULT false NOT NULL,
	"saved_at" timestamp with time zone,
	"hidden_at" timestamp with time zone,
	"skip_reason" "skip_reason",
	"skip_note" text,
	CONSTRAINT "jobs_dedupeKey_unique" UNIQUE("dedupe_key")
);
--> statement-breakpoint
CREATE TABLE "resume_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"url" text,
	"notes" text DEFAULT '' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resume_versions_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "source_visits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" text NOT NULL,
	"visited_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "application_events" ADD CONSTRAINT "application_events_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_resume_version_id_resume_versions_id_fk" FOREIGN KEY ("resume_version_id") REFERENCES "public"."resume_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fetch_run_sources" ADD CONSTRAINT "fetch_run_sources_run_id_fetch_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."fetch_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_sightings" ADD CONSTRAINT "job_sightings_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "application_events_application_id_occurred_at_index" ON "application_events" USING btree ("application_id","occurred_at");--> statement-breakpoint
CREATE INDEX "applications_applied_at_index" ON "applications" USING btree ("applied_at");--> statement-breakpoint
CREATE INDEX "applications_status_index" ON "applications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "fetch_runs_started_at_index" ON "fetch_runs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "jobs_first_seen_at_index" ON "jobs" USING btree ("first_seen_at");--> statement-breakpoint
CREATE INDEX "jobs_posted_at_index" ON "jobs" USING btree ("posted_at");--> statement-breakpoint
CREATE INDEX "jobs_company_id_index" ON "jobs" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "jobs_hidden_at_index" ON "jobs" USING btree ("hidden_at");--> statement-breakpoint
CREATE INDEX "source_visits_source_id_visited_at_index" ON "source_visits" USING btree ("source_id","visited_at");--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "account_provider_accountId_idx" ON "account" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");