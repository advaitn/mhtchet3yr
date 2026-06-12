-- CreateEnum
CREATE TYPE "Course" AS ENUM ('LLB_3', 'LLB_5');

-- CreateTable
CREATE TABLE "admission_cycles" (
    "id" TEXT NOT NULL,
    "course" "Course" NOT NULL,
    "year" INTEGER NOT NULL,
    "slug" TEXT NOT NULL,
    "source_file" TEXT,
    "row_count" INTEGER NOT NULL DEFAULT 0,
    "imported_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admission_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merit_entries" (
    "id" TEXT NOT NULL,
    "cycle_id" TEXT NOT NULL,
    "university_id" TEXT NOT NULL,
    "university_name" TEXT NOT NULL,
    "college_id" TEXT NOT NULL,
    "college_name" TEXT NOT NULL,
    "division_id" TEXT NOT NULL,
    "division_name" TEXT NOT NULL,
    "merit_no" INTEGER NOT NULL,
    "merit_percentile" DECIMAL(10,7) NOT NULL,
    "application_id" TEXT NOT NULL,
    "candidate_name" TEXT NOT NULL,
    "candidature_type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "eligible_in_open_category" TEXT NOT NULL,
    "differently_abled_ph" TEXT NOT NULL,
    "orphan" TEXT NOT NULL,
    "ex_servicemen" TEXT NOT NULL,
    "ex_servicemen_merit_no" TEXT,
    "ex_servicemen_priority" TEXT,
    "minority_details" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "merit_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admission_cycles_slug_key" ON "admission_cycles"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "admission_cycles_course_year_key" ON "admission_cycles"("course", "year");

-- CreateIndex
CREATE INDEX "merit_entries_cycle_id_idx" ON "merit_entries"("cycle_id");

-- CreateIndex
CREATE INDEX "merit_entries_cycle_id_category_idx" ON "merit_entries"("cycle_id", "category");

-- CreateIndex
CREATE INDEX "merit_entries_cycle_id_college_id_category_idx" ON "merit_entries"("cycle_id", "college_id", "category");

-- CreateIndex
CREATE INDEX "merit_entries_cycle_id_merit_percentile_idx" ON "merit_entries"("cycle_id", "merit_percentile");

-- AddForeignKey
ALTER TABLE "merit_entries" ADD CONSTRAINT "merit_entries_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "admission_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
