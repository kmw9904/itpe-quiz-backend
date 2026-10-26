-- Add network exam ID without changing existing records.
ALTER TYPE "ExamId" ADD VALUE IF NOT EXISTS 'network';
