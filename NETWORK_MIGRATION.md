# 네트워크관리사 2급 시험 유형 배포 체크

2026-10-26 기준으로 프런트엔드 `itpe-quiz`와 백엔드에 새로운 시험 ID `network`를 추가했습니다.

## DB 마이그레이션 (운영 필수)

PostgreSQL의 기존 `ExamId` enum은 `itpe`, `bigdata`, `gov`만 존재하므로 새 문제의 학습기록을 DB에 저장하기 전에 스키마 배포가 필요합니다.

1. **운영 DB 백업** (기존 학습 기록 유지)
2. 운영 DB의 `DATABASE_URL`, `DIRECT_URL`이 준비된 안전한 실행 환경에서:

```bash
npm ci
npx prisma migrate deploy
npx prisma generate
```

3. `prisma/migrations/20261026000000_add_network_exam/migration.sql` 적용 확인
4. Vercel에서 백엔드 재배포 후 로그인 계정으로 네트워크 문제 1개 풀이 → 별표/오답/진행정보 저장 → 로그아웃/로그인 → 기록 복원을 확인

마이그레이션은 기존 enum 값을 삭제하거나 문제/회원 데이터를 초기화하지 않고, `network`만 추가합니다.

**주의:** Vercel 빌드 성공 상태는 PostgreSQL 마이그레이션 성공을 뜻하지 않습니다. SQL을 반영하지 않으면 네트워크 시험의 서버 저장이 실패할 수 있습니다.

## 앱 문제 수록 현황

2025년 1회 원문 20문항만 검수 후 앱에 수록되어 있으며 전체 2021~2026년 23회차는 미완료입니다. 현재 회차는 '연습'으로 실행되어 합격/불합격을 판정하지 않습니다. `src/data/questionBank/network` 아래 회차별로 추가할 수 있습니다.
