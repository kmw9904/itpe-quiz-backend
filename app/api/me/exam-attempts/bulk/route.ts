import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fail } from "@/lib/http";
import { toJson } from "@/lib/local-data";

const attemptSchema = z.object({
  attemptNo: z.number().int().positive(),
  score: z.number().int(),
  total: z.number().int().positive(),
  passed: z.boolean(),
  wrongQids: z.array(z.string()),
  createdAt: z.number().int().positive(),
  subjectScores: z
    .object({
      subject1: z.number(),
      subject2: z.number(),
      subject3: z.number(),
      subject4: z.number(),
    })
    .optional(),
  perQuestionSnapshot: z.unknown().optional(),
});

const examResultSchema = z.object({
  examId: z.enum(["itpe", "bigdata", "gov"]),
  year: z.number().int().positive(),
  round: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
  attempts: z.array(attemptSchema),
});

const bulkSchema = z.object({
  items: z.array(examResultSchema),
});

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export async function POST(request: Request) {
  try {
    const { user } = await requireUser(request);
    const body = bulkSchema.parse(await request.json());

    const existingParents = await prisma.examResult.findMany({
      where: { userId: user.id },
      select: { id: true },
    });

    const existingParentIds = existingParents.map((item) => item.id);

    if (existingParentIds.length > 0) {
      await prisma.examAttempt.deleteMany({
        where: {
          examResultId: { in: existingParentIds },
        },
      });
    }

    await prisma.examResult.deleteMany({
      where: { userId: user.id },
    });

    let examResultCount = 0;
    let examAttemptCount = 0;

    for (const item of body.items) {
      const parent = await prisma.examResult.create({
        data: {
          userId: user.id,
          examId: item.examId,
          year: item.year,
          round: item.round,
          updatedAt: new Date(item.updatedAt),
        },
      });

      examResultCount += 1;

      const attemptRows = item.attempts.map((attempt) => ({
        examResultId: parent.id,
        attemptNo: attempt.attemptNo,
        score: attempt.score,
        total: attempt.total,
        passed: attempt.passed,
        wrongQids: attempt.wrongQids,
        createdAt: new Date(attempt.createdAt),
        subjectScores: attempt.subjectScores
          ? toJson(attempt.subjectScores)
          : undefined,
        perQuestionSnapshot: attempt.perQuestionSnapshot
          ? toJson(attempt.perQuestionSnapshot)
          : undefined,
      }));

      for (const chunk of chunkArray(attemptRows, 200)) {
        if (chunk.length === 0) continue;

        await prisma.examAttempt.createMany({
          data: chunk,
        });

        examAttemptCount += chunk.length;
      }
    }

    return Response.json({
      ok: true,
      message: "시험 기록 전체가 계정 DB에 저장되었습니다.",
      counts: {
        examResultTotal: examResultCount,
        examAttemptTotal: examAttemptCount,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return fail(401, "로그인이 필요합니다.");
    }

    if (error instanceof z.ZodError) {
      return fail(400, "시험 기록 bulk 저장 요청 형식이 올바르지 않습니다.", {
        issues: error.issues,
      });
    }

    console.error("[POST /api/me/exam-attempts/bulk]", error);
    return fail(500, "시험 기록 bulk 저장 중 오류가 발생했습니다.");
  }
}
