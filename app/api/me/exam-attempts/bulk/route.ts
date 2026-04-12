import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fail } from "@/lib/http";

const statSchema = z.object({
  solvedCount: z.number().int().nonnegative(),
  wrongCount: z.number().int().nonnegative(),
  correctStreak: z.number().int().nonnegative(),
  lastSolvedAt: z.number().int().nonnegative(),
  nextReviewAt: z.number().int().positive().optional(),
  year: z.number().int().nonnegative(),
  round: z.number().int().nonnegative(),
  type: z.string().trim().min(1),
  subjectType: z.number().int().optional(),
});

const groupedWrongSchema = z.object({
  itpe: z.array(z.string()).default([]),
  bigdata: z.array(z.string()).default([]),
  gov: z.array(z.string()).default([]),
});

const groupedStatsSchema = z.object({
  itpe: z.record(statSchema).default({}),
  bigdata: z.record(statSchema).default({}),
  gov: z.record(statSchema).default({}),
});

const bulkSchema = z.object({
  wrongGrouped: groupedWrongSchema,
  statsGrouped: groupedStatsSchema,
});

const EXAMS = ["itpe", "bigdata", "gov"] as const;

function uniqueStrings(values: string[]) {
  return [
    ...new Set(values.map((item) => String(item).trim()).filter(Boolean)),
  ];
}

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

    const wrongGrouped = {
      itpe: uniqueStrings(body.wrongGrouped.itpe),
      bigdata: uniqueStrings(body.wrongGrouped.bigdata),
      gov: uniqueStrings(body.wrongGrouped.gov),
    };

    const wrongRows = EXAMS.flatMap((examId) =>
      wrongGrouped[examId].map((questionId) => ({
        userId: user.id,
        examId,
        questionId,
      })),
    );

    const statRows = EXAMS.flatMap((examId) =>
      Object.entries(body.statsGrouped[examId] ?? {}).map(
        ([questionId, stat]) => ({
          userId: user.id,
          examId,
          questionId,
          solvedCount: stat.solvedCount,
          wrongCount: stat.wrongCount,
          correctStreak: stat.correctStreak,
          lastSolvedAt: stat.lastSolvedAt ? new Date(stat.lastSolvedAt) : null,
          nextReviewAt: stat.nextReviewAt ? new Date(stat.nextReviewAt) : null,
          year: stat.year,
          round: stat.round,
          type: stat.type,
          subjectType: stat.subjectType,
        }),
      ),
    );

    await prisma.wrongQuestion.deleteMany({
      where: {
        userId: user.id,
      },
    });

    await prisma.questionStat.deleteMany({
      where: {
        userId: user.id,
      },
    });

    for (const chunk of chunkArray(wrongRows, 500)) {
      if (chunk.length === 0) continue;

      await prisma.wrongQuestion.createMany({
        data: chunk,
        skipDuplicates: true,
      });
    }

    for (const chunk of chunkArray(statRows, 300)) {
      if (chunk.length === 0) continue;

      await prisma.questionStat.createMany({
        data: chunk,
      });
    }

    return Response.json({
      ok: true,
      message: "문제 진행 정보 전체가 계정 DB에 저장되었습니다.",
      counts: {
        wrongTotal: wrongRows.length,
        statTotal: statRows.length,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return fail(401, "로그인이 필요합니다.");
    }

    if (error instanceof z.ZodError) {
      return fail(400, "문제 진행 bulk 저장 요청 형식이 올바르지 않습니다.", {
        issues: error.issues,
      });
    }

    console.error("[POST /api/me/question-progress/bulk]", error);
    return fail(500, "문제 진행 bulk 저장 중 오류가 발생했습니다.");
  }
}
