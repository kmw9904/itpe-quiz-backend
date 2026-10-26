import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fail } from "@/lib/http";
import { toJson } from "@/lib/local-data";

const attemptSchema = z.object({
  examId: z.enum(["itpe", "bigdata", "gov", "network"]),
  year: z.number().int().positive(),
  round: z.number().int().positive(),
  attempt: z.object({
    score: z.number().int(),
    total: z.number().int().positive(),
    passed: z.boolean(),
    wrongQids: z.array(z.string()),
    createdAt: z.number().int().positive().optional(),
    subjectScores: z
      .object({
        subject1: z.number(),
        subject2: z.number(),
        subject3: z.number(),
        subject4: z.number(),
      })
      .optional(),
    perQuestionSnapshot: z.unknown().optional(),
  }),
});

export async function GET(request: Request) {
  try {
    const { user } = await requireUser(request);
    const url = new URL(request.url);
    const examId = url.searchParams.get("examId");

    const rows = await prisma.examResult.findMany({
      where: {
        userId: user.id,
        ...(examId ? { examId: examId as "itpe" | "bigdata" | "gov" | "network" } : {}),
      },
      include: {
        attempts: {
          orderBy: { attemptNo: "asc" },
        },
      },
      orderBy: [{ updatedAt: "desc" }, { year: "desc" }, { round: "desc" }],
    });

    return Response.json({
      ok: true,
      items: rows.map((row) => ({
        examId: row.examId,
        year: row.year,
        round: row.round,
        updatedAt: row.updatedAt,
        attempts: row.attempts,
      })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return fail(401, "로그인이 필요합니다.");
    }

    console.error("[GET /api/me/exam-attempts]", error);
    return fail(500, "시험 기록을 불러오지 못했습니다.");
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireUser(request);
    const body = attemptSchema.parse(await request.json());

    const result = await prisma.$transaction(async (tx) => {
      const parent = await tx.examResult.upsert({
        where: {
          userId_examId_year_round: {
            userId: user.id,
            examId: body.examId,
            year: body.year,
            round: body.round,
          },
        },
        create: {
          userId: user.id,
          examId: body.examId,
          year: body.year,
          round: body.round,
          updatedAt: new Date(),
        },
        update: {
          updatedAt: new Date(),
        },
        include: {
          attempts: {
            orderBy: { attemptNo: "desc" },
            take: 1,
          },
        },
      });

      const lastAttemptNo = parent.attempts[0]?.attemptNo ?? 0;

      const created = await tx.examAttempt.create({
        data: {
          examResultId: parent.id,
          attemptNo: lastAttemptNo + 1,
          score: body.attempt.score,
          total: body.attempt.total,
          passed: body.attempt.passed,
          wrongQids: body.attempt.wrongQids,
          createdAt: new Date(body.attempt.createdAt ?? Date.now()),
          subjectScores: body.attempt.subjectScores ? toJson(body.attempt.subjectScores) : undefined,
          perQuestionSnapshot: body.attempt.perQuestionSnapshot ? toJson(body.attempt.perQuestionSnapshot) : undefined,
        },
      });

      return created;
    });

    return Response.json({
      ok: true,
      message: "시험 결과가 저장되었습니다.",
      attempt: result,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return fail(401, "로그인이 필요합니다.");
    }

    if (error instanceof z.ZodError) {
      return fail(400, "시험 기록 저장 요청 형식이 올바르지 않습니다.", {
        issues: error.issues,
      });
    }

    console.error("[POST /api/me/exam-attempts]", error);
    return fail(500, "시험 결과 저장 중 오류가 발생했습니다.");
  }
}
