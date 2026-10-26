import { requireUser } from "@/lib/auth";
import { fail } from "@/lib/http";
import { findMyReport, publicReport } from "@/lib/question-reports";
export async function GET(request: Request, context: { params: Promise<{id: string}> }) {
  try {
    const { user } = await requireUser(request);
    const { id } = await context.params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return fail(400, "올바르지 않은 신고번호입니다.");
    const item = await findMyReport(user.id, id);
    if (!item) return fail(404, "접수 내역을 찾지 못했어요.");
    return Response.json(publicReport(item));
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return fail(401, "로그인이 필요합니다.");
    console.error("[GET /api/me/reports/id]", e);
    return fail(500, "오류 제보 내역을 불러오지 못했습니다.");
  }
}
