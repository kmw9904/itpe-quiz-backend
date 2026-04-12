import type { ExamId as PrismaExamId, Prisma } from "@prisma/client";

export type ExamId = "itpe" | "bigdata" | "gov";

export type SubjectScores = {
  subject1: number;
  subject2: number;
  subject3: number;
  subject4: number;
};

export type PerQuestionProgress = {
  inputsByQid: Record<string, string[]>;
  isCheckedByQid: Record<string, boolean>;
  isCorrectByQid: Record<string, boolean>;
  selectedChoiceByQid: Record<string, number | null>;
  choiceCheckedByQid: Record<string, boolean>;
  eliminatedChoiceNosByQid: Record<string, number[]>;
};

export type QuestionStatInput = {
  solvedCount: number;
  wrongCount: number;
  correctStreak: number;
  lastSolvedAt: number;
  nextReviewAt?: number;
  year: number;
  round: number;
  type: string;
  subjectType?: number;
};

export type ExamAttemptInput = {
  attemptNo: number;
  score: number;
  total: number;
  passed: boolean;
  wrongQids: string[];
  createdAt: number;
  subjectScores?: SubjectScores;
  perQuestionSnapshot?: PerQuestionProgress;
};

export type ExamResultInput = {
  examId: ExamId;
  year: number;
  round: number;
  attempts: ExamAttemptInput[];
  updatedAt: number;
};

export type UserStateInput = {
  starredIdsByExam: Record<ExamId, string[]>;
  wrongIdsByExam: Record<ExamId, string[]>;
  examResults: ExamResultInput[];
  questionStatsByExam: Record<ExamId, Record<string, QuestionStatInput>>;
};

export type InProgressInput = {
  examId: ExamId;
  mode: string;
  deckIds: string[];
  index: number;
  activeExam?: {
    examId: ExamId;
    year: number;
    round: number;
  };
  perQuestion: PerQuestionProgress;
  examSessionWrongQids?: string[];
  savedAt: number;
};

export type LocalSnapshotInput = {
  userState: UserStateInput;
  inProgress: InProgressInput | null;
};

export const DEFAULT_USER_STATE: UserStateInput = {
  starredIdsByExam: { itpe: [], bigdata: [], gov: [] },
  wrongIdsByExam: { itpe: [], bigdata: [], gov: [] },
  examResults: [],
  questionStatsByExam: { itpe: {}, bigdata: {}, gov: {} },
};

export function emptyPerQuestionProgress(): PerQuestionProgress {
  return {
    inputsByQid: {},
    isCheckedByQid: {},
    isCorrectByQid: {},
    selectedChoiceByQid: {},
    choiceCheckedByQid: {},
    eliminatedChoiceNosByQid: {},
  };
}

function parseExamId(value: unknown): ExamId {
  return value === "bigdata" ? "bigdata" : value === "gov" ? "gov" : "itpe";
}

export function toPrismaExamId(value: ExamId): PrismaExamId {
  return value;
}

function parseStringArrayRecord(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      Array.isArray(item) ? item.map((entry) => String(entry ?? "")) : [],
    ]),
  );
}

function parseBooleanRecord(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, Boolean(item)]),
  );
}

function parseNullableNumberRecord(value: unknown): Record<string, number | null> {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, typeof item === "number" ? item : null]),
  );
}

function parseNumberArrayRecord(value: unknown): Record<string, number[]> {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      Array.isArray(item) ? item.map((entry) => Number(entry)).filter((entry) => Number.isFinite(entry)) : [],
    ]),
  );
}

export function normalizePerQuestionProgress(value: unknown): PerQuestionProgress {
  if (!value || typeof value !== "object") {
    return emptyPerQuestionProgress();
  }

  const raw = value as Partial<PerQuestionProgress>;
  return {
    inputsByQid: parseStringArrayRecord(raw.inputsByQid),
    isCheckedByQid: parseBooleanRecord(raw.isCheckedByQid),
    isCorrectByQid: parseBooleanRecord(raw.isCorrectByQid),
    selectedChoiceByQid: parseNullableNumberRecord(raw.selectedChoiceByQid),
    choiceCheckedByQid: parseBooleanRecord(raw.choiceCheckedByQid),
    eliminatedChoiceNosByQid: parseNumberArrayRecord(raw.eliminatedChoiceNosByQid),
  };
}

function normalizeSubjectScores(value: unknown): SubjectScores | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Partial<SubjectScores>;
  if (
    typeof raw.subject1 !== "number" ||
    typeof raw.subject2 !== "number" ||
    typeof raw.subject3 !== "number" ||
    typeof raw.subject4 !== "number"
  ) {
    return undefined;
  }

  return {
    subject1: raw.subject1,
    subject2: raw.subject2,
    subject3: raw.subject3,
    subject4: raw.subject4,
  };
}

function normalizeQuestionStatsRecord(value: unknown): Record<string, QuestionStatInput> {
  if (!value || typeof value !== "object") return {};

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([qid, raw]) => {
      const item = (raw ?? {}) as Partial<QuestionStatInput>;

      return [
        qid,
        {
          solvedCount: Number(item.solvedCount ?? 0),
          wrongCount: Number(item.wrongCount ?? 0),
          correctStreak: Number(item.correctStreak ?? 0),
          lastSolvedAt: Number(item.lastSolvedAt ?? 0),
          nextReviewAt: typeof item.nextReviewAt === "number" ? item.nextReviewAt : undefined,
          year: Number(item.year ?? 0),
          round: Number(item.round ?? 0),
          type: String(item.type ?? ""),
          subjectType: typeof item.subjectType === "number" ? item.subjectType : undefined,
        } satisfies QuestionStatInput,
      ];
    }),
  );
}

export function normalizeUserState(input: unknown): UserStateInput {
  if (!input || typeof input !== "object") {
    return DEFAULT_USER_STATE;
  }

  const parsed = input as Record<string, unknown>;

  const starredIdsByExam = {
    itpe: Array.isArray((parsed as any).starredIdsByExam?.itpe)
      ? (parsed as any).starredIdsByExam.itpe.map((item: unknown) => String(item))
      : Array.isArray((parsed as any).starredIds)
        ? (parsed as any).starredIds.map((item: unknown) => String(item))
        : [],
    bigdata: Array.isArray((parsed as any).starredIdsByExam?.bigdata)
      ? (parsed as any).starredIdsByExam.bigdata.map((item: unknown) => String(item))
      : [],
    gov: Array.isArray((parsed as any).starredIdsByExam?.gov)
      ? (parsed as any).starredIdsByExam.gov.map((item: unknown) => String(item))
      : [],
  } satisfies Record<ExamId, string[]>;

  const wrongIdsByExam = {
    itpe: Array.isArray((parsed as any).wrongIdsByExam?.itpe)
      ? (parsed as any).wrongIdsByExam.itpe.map((item: unknown) => String(item))
      : Array.isArray((parsed as any).wrongIds)
        ? (parsed as any).wrongIds.map((item: unknown) => String(item))
        : [],
    bigdata: Array.isArray((parsed as any).wrongIdsByExam?.bigdata)
      ? (parsed as any).wrongIdsByExam.bigdata.map((item: unknown) => String(item))
      : [],
    gov: Array.isArray((parsed as any).wrongIdsByExam?.gov)
      ? (parsed as any).wrongIdsByExam.gov.map((item: unknown) => String(item))
      : [],
  } satisfies Record<ExamId, string[]>;

  const examResults: ExamResultInput[] = Array.isArray((parsed as any).examResults)
    ? (parsed as any).examResults.map((result: any) => {
        const examId = parseExamId(result?.examId);
        const year = Number(result?.year ?? 0);
        const round = Number(result?.round ?? 0);
        const updatedAt = Number(result?.updatedAt ?? Date.now());

        if (Array.isArray(result?.attempts)) {
          const attempts: ExamAttemptInput[] = result.attempts.map((attempt: any, index: number) => ({
            attemptNo: Number(attempt?.attemptNo ?? index + 1),
            score: Number(attempt?.score ?? 0),
            total: Number(attempt?.total ?? 100),
            passed: Boolean(attempt?.passed ?? Number(attempt?.score ?? 0) >= 60),
            wrongQids: Array.isArray(attempt?.wrongQids) ? attempt.wrongQids.map((item: unknown) => String(item)) : [],
            createdAt: Number(attempt?.createdAt ?? updatedAt),
            subjectScores: normalizeSubjectScores(attempt?.subjectScores),
            perQuestionSnapshot: attempt?.perQuestionSnapshot ? normalizePerQuestionProgress(attempt.perQuestionSnapshot) : undefined,
          }));

          return {
            examId,
            year,
            round,
            attempts,
            updatedAt,
          };
        }

        return {
          examId,
          year,
          round,
          updatedAt,
          attempts: [
            {
              attemptNo: 1,
              score: Number(result?.score ?? 0),
              total: Number(result?.total ?? 100),
              passed: Boolean(result?.passed ?? Number(result?.score ?? 0) >= 60),
              wrongQids: Array.isArray(result?.wrongQids) ? result.wrongQids.map((item: unknown) => String(item)) : [],
              createdAt: updatedAt,
              subjectScores: normalizeSubjectScores(result?.subjectScores),
              perQuestionSnapshot: result?.perQuestionSnapshot ? normalizePerQuestionProgress(result.perQuestionSnapshot) : undefined,
            },
          ],
        };
      })
    : [];

  return {
    starredIdsByExam,
    wrongIdsByExam,
    examResults,
    questionStatsByExam: {
      itpe: normalizeQuestionStatsRecord((parsed as any).questionStatsByExam?.itpe),
      bigdata: normalizeQuestionStatsRecord((parsed as any).questionStatsByExam?.bigdata),
      gov: normalizeQuestionStatsRecord((parsed as any).questionStatsByExam?.gov),
    },
  };
}

export function normalizeInProgress(input: unknown): InProgressInput | null {
  if (!input || typeof input !== "object") return null;
  const parsed = input as Record<string, unknown>;

  return {
    examId: parseExamId(parsed.examId),
    mode: String(parsed.mode ?? "all"),
    deckIds: Array.isArray(parsed.deckIds) ? parsed.deckIds.map((item) => String(item)) : [],
    index: Number(parsed.index ?? 0),
    activeExam:
      parsed.activeExam && typeof parsed.activeExam === "object"
        ? {
            examId: parseExamId((parsed.activeExam as Record<string, unknown>).examId),
            year: Number((parsed.activeExam as Record<string, unknown>).year ?? 0),
            round: Number((parsed.activeExam as Record<string, unknown>).round ?? 0),
          }
        : undefined,
    perQuestion: normalizePerQuestionProgress(parsed.perQuestion),
    examSessionWrongQids: Array.isArray(parsed.examSessionWrongQids)
      ? parsed.examSessionWrongQids.map((item) => String(item))
      : [],
    savedAt: Number(parsed.savedAt ?? Date.now()),
  };
}

export function normalizeLocalSnapshot(input: unknown): LocalSnapshotInput {
  if (!input || typeof input !== "object") {
    return {
      userState: DEFAULT_USER_STATE,
      inProgress: null,
    };
  }

  const parsed = input as Record<string, unknown>;
  return {
    userState: normalizeUserState(parsed.userState),
    inProgress: normalizeInProgress(parsed.inProgress),
  };
}

export function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}
