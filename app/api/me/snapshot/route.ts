import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { fail } from "@/lib/http";
import { buildSnapshotForUser } from "@/lib/snapshot";

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
    "snapshot 전체 업로드는 더 이상 사용하지 않습니다. /api/migration/import-local 또는 개별 progress API를 사용하세요.",
  );
}
