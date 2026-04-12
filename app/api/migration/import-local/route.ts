import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { fail } from "@/lib/http";
import { buildSnapshotForUser } from "@/lib/snapshot";
import { importLocalSnapshotSafe } from "@/lib/import-local-data";

const importSchema = z.object({
  localSnapshot: z.unknown(),
});

export async function POST(request: Request) {
  try {
    const { user } = await requireUser(request);
    const body = importSchema.parse(await request.json());

    await importLocalSnapshotSafe(user.id, body.localSnapshot);
    const snapshot = await buildSnapshotForUser(user.id);

    return Response.json({
      ok: true,
      message: "로컬 데이터가 계정 DB로 병합 저장되었습니다.",
      snapshot,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return fail(401, "로그인이 필요합니다.");
    }

    if (error instanceof z.ZodError) {
      return fail(400, "로컬 데이터 이관 요청 형식이 올바르지 않습니다.", {
        issues: error.issues,
      });
    }

    console.error("[POST /api/migration/import-local]", error);
    return fail(500, "로컬 데이터 이관 중 오류가 발생했습니다.");
  }
}
