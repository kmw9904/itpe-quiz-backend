import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fail } from "@/lib/http";

const writeSchema = z.object({
  examId: z.enum(["itpe", "bigdata", "gov", "network"]),
  questionId: z.string().trim().min(1),
});

export async function GET(request: Request) {
  try {
    const { user } = await requireUser(request);
    const url = new URL(request.url);
    const examId = url.searchParams.get("examId");

    const rows = await prisma.starredQuestion.findMany({
      where: {
        userId: user.id,
        ...(examId ? { examId: examId as "itpe" | "bigdata" | "gov" | "network" } : {}),
      },
      orderBy: { createdAt: "asc" },
    });

    return Response.json({
      ok: true,
      items: rows,
      grouped: {
        itpe: rows.filter((item) => item.examId === "itpe").map((item) => item.questionId),
        bigdata: rows.filter((item) => item.examId === "bigdata").map((item) => item.questionId),
        gov: rows.filter((item) => item.examId === "gov").map((item) => item.questionId),
        network: rows.filter((item) => item.examId === "network").map((item) => item.questionId),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return fail(401, "로그인이 필요합니다.");
    }

    console.error("[GET /api/me/stars]", error);
    return fail(500, "별표 목록을 불러오지 못했습니다.");
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireUser(request);
    const body = writeSchema.parse(await request.json());

    await prisma.starredQuestion.upsert({
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

    return Response.json({
      ok: true,
      message: "별표가 저장되었습니다.",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return fail(401, "로그인이 필요합니다.");
    }

    if (error instanceof z.ZodError) {
      return fail(400, "별표 저장 요청 형식이 올바르지 않습니다.", {
        issues: error.issues,
      });
    }

    console.error("[POST /api/me/stars]", error);
    return fail(500, "별표 저장 중 오류가 발생했습니다.");
  }
}

export async function DELETE(request: Request) {
  try {
    const { user } = await requireUser(request);
    const body = writeSchema.parse(await request.json());

    await prisma.starredQuestion.deleteMany({
      where: {
        userId: user.id,
        examId: body.examId,
        questionId: body.questionId,
      },
    });

    return Response.json({
      ok: true,
      message: "별표가 해제되었습니다.",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return fail(401, "로그인이 필요합니다.");
    }

    if (error instanceof z.ZodError) {
      return fail(400, "별표 삭제 요청 형식이 올바르지 않습니다.", {
        issues: error.issues,
      });
    }

    console.error("[DELETE /api/me/stars]", error);
    return fail(500, "별표 삭제 중 오류가 발생했습니다.");
  }
}
