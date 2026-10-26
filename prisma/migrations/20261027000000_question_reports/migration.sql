-- Safe, additive table to support authenticated user-specific issue reports.
CREATE TABLE IF NOT EXISTS "AppQuestionReport" (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  exam_id TEXT NOT NULL,
  year INTEGER NOT NULL,
  round INTEGER NOT NULL,
  qno INTEGER NOT NULL,
  question_id TEXT,
  report_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS app_question_report_user_index
ON "AppQuestionReport" (user_id, created_at DESC);
