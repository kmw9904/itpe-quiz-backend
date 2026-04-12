import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fail } from "@/lib/http";
import { mergeLocalSnapshotTx } from "@/lib/import-local-data";
import { buildSnapshotForUser } from "@/lib/snapshot";

const importSchema = z.object({
  deviceId: z.string().trim().min(1).max(200),
  importVersion: z.number().int().positive().default(1),
  localSnapshot: z.unknown(),
});

export async function POST(request: Request) {
  try {
    const { user } = await requireUser(request);
    const body = importSchema.parse(await request.json());

    const result = await prisma.$transaction(async (tx) =>
      mergeLocalSnapshotTx(tx, {
        userId: user.id,
        deviceId: body.deviceId,
        importVersion: body.importVersion,
        source: "manual-import-local",
        writeMigrationLog: true,
        preventDuplicateImport: true,
        localSnapshot: body.localSnapshot,
      }),
    );

    const snapshot = await buildSnapshotForUser(user.id);

    return Response.json({
      ok: true,
      imported: result.imported,
      reason: !result.imported ? result.reason : undefined,
      snapshot,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return fail(401, "로그인이 필요합니다.");
    }

    if (error instanceof z.ZodError) {
      return fail(400, "import 요청 형식이 올바르지 않습니다.", {
        issues: error.issues,
      });
    }

    console.error("[POST /api/migration/import-local]", error);
    return fail(500, "로컬 기록 가져오기 중 오류가 발생했습니다.");
  }
}
