ALTER TYPE "ArticleStatus" ADD VALUE IF NOT EXISTS 'needs_revision' BEFORE 'approved';

alter table articles add column revision_requested_at timestamptz;
