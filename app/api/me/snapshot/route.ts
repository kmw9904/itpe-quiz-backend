import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fail } from "@/lib/http";
import { buildSnapshotForUser } from "@/lib/snapshot";
import { mergeLocalSnapshotTx } from "@/lib/import-local-data";

const updateSchema = z.object({
  localSnapshot: z.unknown(),
});

export async function GET(request: Request) {
  try {
    const { user } = await requireUser(request);
    const snapshot = await buildSnapshotForUser(user.id);

    return Response.json({
      ok: true,
      snapshot,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return fail(401, "로그인이 필요합니다.");
    }

    console.error("[GET /api/me/snapshot]", error);
    return fail(500, "snapshot 조회 중 오류가 발생했습니다.");
  }
}

export async function PUT(request: Request) {
  try {
    const { user } = await requireUser(request);
    const body = updateSchema.parse(await request.json());

    await prisma.$transaction(async (tx) => {
      await mergeLocalSnapshotTx(tx, {
        userId: user.id,
        localSnapshot: body.localSnapshot,
        writeMigrationLog: false,
      });
    });

    const snapshot = await buildSnapshotForUser(user.id);

    return Response.json({
      ok: true,
      message: "snapshot 이 병합 저장되었습니다.",
      snapshot,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return fail(401, "로그인이 필요합니다.");
    }

    if (error instanceof z.ZodError) {
      return fail(400, "snapshot 요청 형식이 올바르지 않습니다.", {
        issues: error.issues,
      });
    }

    console.error("[PUT /api/me/snapshot]", error);
    return fail(500, "snapshot 저장 중 오류가 발생했습니다.");
  }
}
