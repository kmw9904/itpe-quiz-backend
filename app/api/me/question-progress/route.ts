import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fail } from "@/lib/http";

const examIdSchema = z.enum(["itpe", "bigdata", "gov"]);

const statSchema = z.object({
  solvedCount: z.number().int().nonnegative(),
  wrongCount: z.number().int().nonnegative(),
  correctStreak: z.number().int().nonnegative(),
  lastSolvedAt: z.number().int().nonnegative(),
  nextReviewAt: z.number().int().positive().optional(),
  year: z.number().int().positive(),
  round: z.number().int().positive(),
  type: z.string().trim().min(1),
  subjectType: z.number().int().optional(),
});

const upsertSchema = z.object({
  examId: examIdSchema,
  questionId: z.string().trim().min(1),
  isWrong: z.boolean(),
  stat: statSchema,
});

export async function GET(request: Request) {
  try {
    const { user } = await requireUser(request);
    const url = new URL(request.url);
    const examId = url.searchParams.get("examId");

    const [wrongRows, statRows] = await Promise.all([
      prisma.wrongQuestion.findMany({
        where: {
          userId: user.id,
          ...(examId ? { examId: examId as "itpe" | "bigdata" | "gov" } : {}),
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.questionStat.findMany({
        where: {
          userId: user.id,
          ...(examId ? { examId: examId as "itpe" | "bigdata" | "gov" } : {}),
        },
        orderBy: [{ examId: "asc" }, { questionId: "asc" }],
      }),
    ]);

    return Response.json({
      ok: true,
      wrongGrouped: {
        itpe: wrongRows
          .filter((item) => item.examId === "itpe")
          .map((item) => item.questionId),
        bigdata: wrongRows
          .filter((item) => item.examId === "bigdata")
          .map((item) => item.questionId),
        gov: wrongRows
          .filter((item) => item.examId === "gov")
          .map((item) => item.questionId),
      },
      statsGrouped: {
        itpe: Object.fromEntries(
          statRows
            .filter((item) => item.examId === "itpe")
            .map((item) => [
              item.questionId,
              {
                solvedCount: item.solvedCount,
                wrongCount: item.wrongCount,
                correctStreak: item.correctStreak,
                lastSolvedAt: item.lastSolvedAt?.getTime() ?? 0,
                nextReviewAt: item.nextReviewAt?.getTime(),
                year: item.year,
                round: item.round,
                type: item.type,
                subjectType: item.subjectType ?? undefined,
              },
            ]),
        ),
        bigdata: Object.fromEntries(
          statRows
            .filter((item) => item.examId === "bigdata")
            .map((item) => [
              item.questionId,
              {
                solvedCount: item.solvedCount,
                wrongCount: item.wrongCount,
                correctStreak: item.correctStreak,
                lastSolvedAt: item.lastSolvedAt?.getTime() ?? 0,
                nextReviewAt: item.nextReviewAt?.getTime(),
                year: item.year,
                round: item.round,
                type: item.type,
                subjectType: item.subjectType ?? undefined,
              },
            ]),
        ),
        gov: Object.fromEntries(
          statRows
            .filter((item) => item.examId === "gov")
            .map((item) => [
              item.questionId,
              {
                solvedCount: item.solvedCount,
                wrongCount: item.wrongCount,
                correctStreak: item.correctStreak,
                lastSolvedAt: item.lastSolvedAt?.getTime() ?? 0,
                nextReviewAt: item.nextReviewAt?.getTime(),
                year: item.year,
                round: item.round,
                type: item.type,
                subjectType: item.subjectType ?? undefined,
              },
            ]),
        ),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return fail(401, "로그인이 필요합니다.");
    }

    console.error("[GET /api/me/question-progress]", error);
    return fail(500, "문제 진행 정보를 불러오지 못했습니다.");
  }
}

export async function PUT(request: Request) {
  try {
    const { user } = await requireUser(request);
    const body = upsertSchema.parse(await request.json());

    await prisma.$transaction(async (tx) => {
      if (body.isWrong) {
        await tx.wrongQuestion.upsert({
          where: {
            userId_examId_questionId: {
              userId: user.id,
              examId: body.examId,
              questionId: body.questionId,
            },
          },
          create: {
            userId: user.id,
            examId: body.examId,
            questionId: body.questionId,
          },
          update: {},
        });
      } else {
        await tx.wrongQuestion.deleteMany({
          where: {
            userId: user.id,
            examId: body.examId,
            questionId: body.questionId,
          },
        });
      }

      await tx.questionStat.upsert({
        where: {
          userId_examId_questionId: {
            userId: user.id,
            examId: body.examId,
            questionId: body.questionId,
          },
        },
        create: {
          userId: user.id,
          examId: body.examId,
          questionId: body.questionId,
          solvedCount: body.stat.solvedCount,
          wrongCount: body.stat.wrongCount,
          correctStreak: body.stat.correctStreak,
          lastSolvedAt: body.stat.lastSolvedAt
            ? new Date(body.stat.lastSolvedAt)
            : null,
          nextReviewAt: body.stat.nextReviewAt
            ? new Date(body.stat.nextReviewAt)
            : null,
          year: body.stat.year,
          round: body.stat.round,
          type: body.stat.type,
          subjectType: body.stat.subjectType,
        },
        update: {
          solvedCount: body.stat.solvedCount,
          wrongCount: body.stat.wrongCount,
          correctStreak: body.stat.correctStreak,
          lastSolvedAt: body.stat.lastSolvedAt
            ? new Date(body.stat.lastSolvedAt)
            : null,
          nextReviewAt: body.stat.nextReviewAt
            ? new Date(body.stat.nextReviewAt)
            : null,
          year: body.stat.year,
          round: body.stat.round,
          type: body.stat.type,
          subjectType: body.stat.subjectType,
        },
      });
    });

    return Response.json({
      ok: true,
      message: "문제 진행 정보가 저장되었습니다.",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return fail(401, "로그인이 필요합니다.");
    }

    if (error instanceof z.ZodError) {
      return fail(400, "문제 진행 저장 요청 형식이 올바르지 않습니다.", {
        issues: error.issues,
      });
    }

    console.error("[PUT /api/me/question-progress]", error);
    return fail(500, "문제 진행 정보 저장 중 오류가 발생했습니다.");
  }
}
