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

export async function PUT() {
  return fail(
    400,
    "snapshot 전체 업로드는 더 이상 사용하지 않습니다. stars / question-progress / exam-attempts / in-progress API를 사용하세요.",
  );
}
