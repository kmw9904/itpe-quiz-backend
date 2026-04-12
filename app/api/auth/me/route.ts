import { requireUser } from "@/lib/auth";
import { buildSnapshotForUser } from "@/lib/snapshot";
import { fail } from "@/lib/http";

export async function GET(request: Request) {
  try {
    const { user } = await requireUser(request);
    const snapshot = await buildSnapshotForUser(user.id);

    return Response.json({
      ok: true,
      user,
      summary: {
        starCount:
          snapshot.userState.starredIdsByExam.itpe.length +
          snapshot.userState.starredIdsByExam.bigdata.length +
          snapshot.userState.starredIdsByExam.gov.length,
        wrongCount:
          snapshot.userState.wrongIdsByExam.itpe.length +
          snapshot.userState.wrongIdsByExam.bigdata.length +
          snapshot.userState.wrongIdsByExam.gov.length,
        examResultCount: snapshot.userState.examResults.length,
        hasInProgress: Boolean(snapshot.inProgress),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return fail(401, "로그인이 필요합니다.");
    }

    console.error("[GET /api/auth/me]", error);
    return fail(500, "사용자 정보를 불러오지 못했습니다.");
  }
}
