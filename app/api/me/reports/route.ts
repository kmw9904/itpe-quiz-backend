import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { fail } from "@/lib/http";
import { publicReport, submitReport } from "@/lib/question-reports";
const input = z.object({
  examType: z.enum(["itpe", "bigdata", "gov", "network"]),
  year: z.number().int().min(2000).max(2100),
  round: z.number().int().min(1).max(10),
  qno: z.number().int().min(1).max(500),
  reportText: z.string().trim().min(5).max(3000),
  sourceQuestionId: z.string().max(200).optional(),
});
export async function POST(request: Request) {
  try {
    const { user } = await requireUser(request);
    const body = input.parse(await request.json());
    const row = await submitReport(user.id, body);
    if (!row) return fail(429, "하루 제보 횟수(30회)를 초과했어요.");
    return Response.json({ item: publicReport(row) }, { status: 201 });
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return fail(401, "로그인이 필요합니다.");
    if (e instanceof z.ZodError) return fail(400, "제보 내용을 확인해 주세요.");
    console.error("[POST /api/me/reports]", e);
    return fail(500, "오류 제보 서버에 연결할 수 없습니다.");
  }
}
