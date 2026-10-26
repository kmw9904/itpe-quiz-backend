import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
type ReportRow = { id: string; exam_id: string; year: number; round: number; qno: number;
  status: string; created_at: Date; updated_at: Date; };
export async function ensureQuestionReportTable() {
  // Static DDL, idempotent and additive for already running databases.
  await prisma.$executeRawUnsafe(
    'CREATE TABLE IF NOT EXISTS "AppQuestionReport" (' +
    'id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE, ' +
    'exam_id TEXT NOT NULL, year INTEGER NOT NULL, round INTEGER NOT NULL, ' +
    'qno INTEGER NOT NULL, question_id TEXT, report_text TEXT NOT NULL, ' +
    "status TEXT NOT NULL DEFAULT 'pending', " +
    'created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS app_question_report_user_index ' +
    'ON "AppQuestionReport" (user_id, created_at DESC)');
}
export async function submitReport(userId: string, data: {
  examType: string; year: number; round: number; qno: number;
  reportText: string; sourceQuestionId?: string;
}) {
  await ensureQuestionReportTable();
  const [count] = await prisma.$queryRawUnsafe<Array<{ total: bigint }>>(
    'SELECT count(*)::bigint AS total FROM "AppQuestionReport" ' +
    "WHERE user_id = $1 AND created_at >= NOW() - interval '24 hours'", userId);
  if (Number(count?.total ?? 0) >= 30) return null;
  const id = randomUUID();
  const rows = await prisma.$queryRawUnsafe<ReportRow[]>(
    'INSERT INTO "AppQuestionReport" (id, user_id, exam_id, year, round, qno, question_id, report_text) ' +
    'VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ' +
    'RETURNING id, exam_id, year, round, qno, status, created_at, updated_at',
    id, userId, data.examType, data.year, data.round, data.qno,
    data.sourceQuestionId ?? null, data.reportText);
  return rows[0] ?? null;
}
export async function findMyReport(userId: string, id: string) {
  await ensureQuestionReportTable();
  const rows = await prisma.$queryRawUnsafe<ReportRow[]>(
    'SELECT id, exam_id, year, round, qno, status, created_at, updated_at ' +
    'FROM "AppQuestionReport" WHERE user_id = $1 AND id = $2 LIMIT 1', userId, id);
  return rows[0] ?? null;
}
export function publicReport(row: ReportRow) {
  return { id: row.id, examType: row.exam_id, year: row.year,
    round: row.round, qno: row.qno, status: row.status,
    createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString() };
}
