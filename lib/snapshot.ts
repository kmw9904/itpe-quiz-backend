import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  DEFAULT_USER_STATE,
  emptyPerQuestionProgress,
  type LocalSnapshotInput,
  type UserStateInput,
  type PerQuestionProgress,
} from "@/lib/local-data";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toPerQuestionProgress(value: Prisma.JsonValue | null | undefined): PerQuestionProgress {
  if (!isRecord(value)) {
    return emptyPerQuestionProgress();
  }

  return {
    inputsByQid: isRecord(value.inputsByQid)
      ? Object.fromEntries(
          Object.entries(value.inputsByQid).map(([k, v]) => [k, Array.isArray(v) ? v.map((item) => String(item)) : []]),
        )
      : {},
    isCheckedByQid: isRecord(value.isCheckedByQid)
      ? Object.fromEntries(Object.entries(value.isCheckedByQid).map(([k, v]) => [k, Boolean(v)]))
      : {},
    isCorrectByQid: isRecord(value.isCorrectByQid)
      ? Object.fromEntries(Object.entries(value.isCorrectByQid).map(([k, v]) => [k, Boolean(v)]))
      : {},
    selectedChoiceByQid: isRecord(value.selectedChoiceByQid)
      ? Object.fromEntries(
          Object.entries(value.selectedChoiceByQid).map(([k, v]) => [k, typeof v === "number" ? v : null]),
        )
      : {},
    choiceCheckedByQid: isRecord(value.choiceCheckedByQid)
      ? Object.fromEntries(Object.entries(value.choiceCheckedByQid).map(([k, v]) => [k, Boolean(v)]))
      : {},
    eliminatedChoiceNosByQid: isRecord(value.eliminatedChoiceNosByQid)
      ? Object.fromEntries(
          Object.entries(value.eliminatedChoiceNosByQid).map(([k, v]) => [
            k,
            Array.isArray(v) ? v.map((item) => Number(item)).filter((item) => Number.isFinite(item)) : [],
          ]),
        )
      : {},
  };
}

export async function buildSnapshotForUser(userId: string): Promise<LocalSnapshotInput> {
  const [starredQuestions, wrongQuestions, questionStats, examResults, inProgressSessions] = await Promise.all([
    prisma.starredQuestion.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.wrongQuestion.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.questionStat.findMany({
      where: { userId },
      orderBy: [{ examId: "asc" }, { questionId: "asc" }],
    }),
    prisma.examResult.findMany({
      where: { userId },
      include: {
        attempts: {
          orderBy: { attemptNo: "asc" },
        },
      },
      orderBy: [{ updatedAt: "desc" }, { year: "desc" }, { round: "desc" }],
    }),
    prisma.inProgressSession.findMany({
      where: { userId },
      orderBy: { savedAt: "desc" },
      take: 1,
    }),
  ]);

  const userState: UserStateInput = {
    ...DEFAULT_USER_STATE,
    starredIdsByExam: { itpe: [], bigdata: [], gov: [] },
    wrongIdsByExam: { itpe: [], bigdata: [], gov: [] },
    questionStatsByExam: { itpe: {}, bigdata: {}, gov: {} },
    examResults: [],
  };

  for (const item of starredQuestions) {
    userState.starredIdsByExam[item.examId].push(item.questionId);
  }

  for (const item of wrongQuestions) {
    userState.wrongIdsByExam[item.examId].push(item.questionId);
  }

  for (const item of questionStats) {
    userState.questionStatsByExam[item.examId][item.questionId] = {
      solvedCount: item.solvedCount,
      wrongCount: item.wrongCount,
      correctStreak: item.correctStreak,
      lastSolvedAt: item.lastSolvedAt?.getTime() ?? 0,
      nextReviewAt: item.nextReviewAt?.getTime(),
      year: item.year,
      round: item.round,
      type: item.type,
      subjectType: item.subjectType ?? undefined,
    };
  }

  userState.examResults = examResults.map((result) => ({
    examId: result.examId,
    year: result.year,
    round: result.round,
    updatedAt: result.updatedAt.getTime(),
    attempts: result.attempts.map((attempt) => ({
      attemptNo: attempt.attemptNo,
      score: attempt.score,
      total: attempt.total,
      passed: attempt.passed,
      wrongQids: attempt.wrongQids,
      createdAt: attempt.createdAt.getTime(),
      subjectScores: (attempt.subjectScores ?? undefined) as
        | {
            subject1: number;
            subject2: number;
            subject3: number;
            subject4: number;
          }
        | undefined,
      perQuestionSnapshot: toPerQuestionProgress(attempt.perQuestionSnapshot),
    })),
  }));

  const latestSession = inProgressSessions[0] ?? null;

  return {
    userState,
    inProgress: latestSession
      ? {
          examId: latestSession.examId,
          mode: latestSession.mode,
          deckIds: latestSession.deckIds,
          index: latestSession.index,
          activeExam:
            latestSession.activeExam && typeof latestSession.activeExam === "object" && !Array.isArray(latestSession.activeExam)
              ? {
                  examId: String((latestSession.activeExam as Record<string, unknown>).examId ?? "itpe") as "itpe" | "bigdata" | "gov",
                  year: Number((latestSession.activeExam as Record<string, unknown>).year ?? 0),
                  round: Number((latestSession.activeExam as Record<string, unknown>).round ?? 0),
                }
              : undefined,
          perQuestion: toPerQuestionProgress(latestSession.perQuestion),
          examSessionWrongQids: latestSession.examSessionWrongQids,
          savedAt: latestSession.savedAt.getTime(),
        }
      : null,
  };
}
