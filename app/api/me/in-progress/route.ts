import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fail } from "@/lib/http";
import { normalizeInProgress, toJson, toPrismaExamId } from "@/lib/local-data";

const upsertSchema = z.object({
  session: z.unknown(),
});

const deleteSchema = z.object({
  examId: z.enum(["itpe", "bigdata", "gov"]).optional(),
  mode: z.string().optional(),
});

export async function GET(request: Request) {
  try {
    const { user } = await requireUser(request);
    const url = new URL(request.url);
    const examId = url.searchParams.get("examId");
    const mode = url.searchParams.get("mode");

    const rows = await prisma.inProgressSession.findMany({
      where: {
        userId: user.id,
        ...(examId ? { examId: examId as "itpe" | "bigdata" | "gov" } : {}),
        ...(mode ? { mode } : {}),
      },
      orderBy: { savedAt: "desc" },
    });

    return Response.json({
      ok: true,
      items: rows,
      latest: rows[0] ?? null,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return fail(401, "로그인이 필요합니다.");
    }

    console.error("[GET /api/me/in-progress]", error);
    return fail(500, "이어풀기 정보를 불러오지 못했습니다.");
  }
}

export async function PUT(request: Request) {
  try {
    const { user } = await requireUser(request);
    const body = upsertSchema.parse(await request.json());
    const session = normalizeInProgress(body.session);

    if (!session) {
      return fail(400, "유효한 session 값이 필요합니다.");
    }

    const saved = await prisma.inProgressSession.upsert({
      where: {
        userId_examId_mode: {
          userId: user.id,
          examId: toPrismaExamId(session.examId),
          mode: session.mode,
        },
      },
      create: {
        userId: user.id,
        examId: toPrismaExamId(session.examId),
        mode: session.mode,
        deckIds: session.deckIds,
        index: session.index,
        activeExam: session.activeExam ? toJson(session.activeExam) : undefined,
        perQuestion: toJson(session.perQuestion),
        examSessionWrongQids: session.examSessionWrongQids ?? [],
        savedAt: new Date(session.savedAt),
      },
      update: {
        deckIds: session.deckIds,
        index: session.index,
        activeExam: session.activeExam ? toJson(session.activeExam) : undefined,
        perQuestion: toJson(session.perQuestion),
        examSessionWrongQids: session.examSessionWrongQids ?? [],
        savedAt: new Date(session.savedAt),
      },
    });

    return Response.json({
      ok: true,
      message: "이어풀기 상태가 저장되었습니다.",
      session: saved,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return fail(401, "로그인이 필요합니다.");
    }

    if (error instanceof z.ZodError) {
      return fail(400, "이어풀기 저장 요청 형식이 올바르지 않습니다.", {
        issues: error.issues,
      });
    }

    console.error("[PUT /api/me/in-progress]", error);
    return fail(500, "이어풀기 상태 저장 중 오류가 발생했습니다.");
  }
}

export async function DELETE(request: Request) {
  try {
    const { user } = await requireUser(request);
    const body = deleteSchema.parse(await request.json().catch(() => ({})));

    const deleted = await prisma.inProgressSession.deleteMany({
      where: {
        userId: user.id,
        ...(body.examId ? { examId: body.examId } : {}),
        ...(body.mode ? { mode: body.mode } : {}),
      },
    });

    return Response.json({
      ok: true,
      message: "이어풀기 상태가 삭제되었습니다.",
      deletedCount: deleted.count,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return fail(401, "로그인이 필요합니다.");
    }

    if (error instanceof z.ZodError) {
      return fail(400, "이어풀기 삭제 요청 형식이 올바르지 않습니다.", {
        issues: error.issues,
      });
    }

    console.error("[DELETE /api/me/in-progress]", error);
    return fail(500, "이어풀기 상태 삭제 중 오류가 발생했습니다.");
  }
}
