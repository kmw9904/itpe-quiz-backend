import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fail } from "@/lib/http";

const groupedSchema = z.object({
  itpe: z.array(z.string()).default([]),
  bigdata: z.array(z.string()).default([]),
  gov: z.array(z.string()).default([]),
  network: z.array(z.string()).default([]),
});

const bulkSchema = z.object({
  grouped: groupedSchema,
});

const EXAMS = ["itpe", "bigdata", "gov", "network"] as const;

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

    const grouped = {
      itpe: uniqueStrings(body.grouped.itpe),
      bigdata: uniqueStrings(body.grouped.bigdata),
      gov: uniqueStrings(body.grouped.gov),
      network: uniqueStrings(body.grouped.network),
    };

    await prisma.starredQuestion.deleteMany({
      where: {
        userId: user.id,
      },
    });

    const rows = EXAMS.flatMap((examId) =>
      grouped[examId].map((questionId) => ({
        userId: user.id,
        examId,
        questionId,
      })),
    );

    for (const chunk of chunkArray(rows, 500)) {
      if (chunk.length === 0) continue;

      await prisma.starredQuestion.createMany({
        data: chunk,
        skipDuplicates: true,
      });
    }

    return Response.json({
      ok: true,
      message: "별표 전체가 계정 DB에 저장되었습니다.",
      counts: {
        itpe: grouped.itpe.length,
        bigdata: grouped.bigdata.length,
        gov: grouped.gov.length,
        network: grouped.network.length,
        total: rows.length,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return fail(401, "로그인이 필요합니다.");
    }

    if (error instanceof z.ZodError) {
      return fail(400, "별표 bulk 저장 요청 형식이 올바르지 않습니다.", {
        issues: error.issues,
      });
    }

    console.error("[POST /api/me/stars/bulk]", error);
    return fail(500, "별표 bulk 저장 중 오류가 발생했습니다.");
  }
}
