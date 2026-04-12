# itpe-quiz-auth-backend

`itpe-quiz` 앱용으로 만든 **Vercel 배포 가능한 인증 + 기록 저장 백엔드**입니다.

구성은 다음과 같습니다.

- **Next.js App Router**
- **Prisma**
- **PostgreSQL (Neon / Supabase 추천)**
- **JWT Access Token + Refresh Token**
- **회원가입 시 기존 AsyncStorage 기록 1회 가져오기**
- **별표 / 오답 / 시험 기록 / 이어풀기 저장**
- **자동로그인용 refresh API 포함**

---

## 1. 지원 기능

### 인증
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### 로컬 기록 가져오기
- `POST /api/migration/import-local`
- 회원가입 시 `signup` 요청 본문 안에 `localSnapshot`을 같이 넣어도 바로 가져오기 가능

### 학습 데이터
- `GET /api/me/snapshot`
- `PUT /api/me/snapshot`
- `GET /api/me/stars`
- `POST /api/me/stars`
- `DELETE /api/me/stars`
- `GET /api/me/exam-attempts`
- `POST /api/me/exam-attempts`
- `GET /api/me/in-progress`
- `PUT /api/me/in-progress`
- `DELETE /api/me/in-progress`

### 헬스체크
- `GET /api/health`

---

## 2. 자동로그인 방식

이 프로젝트는 **자동로그인**을 위해 두 가지를 같이 제공합니다.

1. **응답 JSON 안의 refreshToken**
2. **httpOnly cookie**

### 모바일 앱(Expo / React Native) 권장
모바일에서는 보통 cookie보다 **SecureStore**가 더 안정적입니다.

권장 흐름:

1. 로그인 또는 회원가입 성공
2. `accessToken`은 메모리 또는 짧은 저장
3. `refreshToken`은 `expo-secure-store`에 저장
4. 앱 재실행 시 `/api/auth/refresh`에 `refreshToken`을 보내 새 access token 발급

즉, 자동로그인은 이렇게 쓰면 됩니다.

```ts
const res = await fetch(`${API_URL}/api/auth/refresh`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    refreshToken: savedRefreshToken,
  }),
});
```

---

## 3. Prisma 설정 방법

### 3-1. 패키지 설치

```bash
npm install
```

### 3-2. 환경변수 복사

`.env.example`을 복사해서 `.env`를 만듭니다.

```bash
cp .env.example .env
```

Windows PowerShell이면:

```powershell
copy .env.example .env
```

### 3-3. `.env` 값 채우기

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DB?sslmode=require"
DIRECT_URL="postgresql://USER:PASSWORD@HOST:5432/DB?sslmode=require"
JWT_ACCESS_SECRET="32자 이상 긴 문자열"
JWT_REFRESH_SECRET="32자 이상 긴 문자열"
ACCESS_TOKEN_TTL_MINUTES="15"
REFRESH_TOKEN_TTL_DAYS="30"
COOKIE_DOMAIN=""
```

### 3-4. Prisma Client 생성

```bash
npx prisma generate
```

### 3-5. DB 마이그레이션

```bash
npx prisma migrate dev --name init
```

운영 배포 환경에서는:

```bash
npx prisma migrate deploy
```

### 3-6. Prisma Studio로 확인

```bash
npx prisma studio
```

---

## 4. Vercel 배포 방법

### 4-1. GitHub에 업로드
이 폴더를 새 레포지토리로 올립니다.

예:
- `itpe-quiz-auth-backend`

### 4-2. Vercel에서 Import
- Vercel → New Project
- GitHub 레포 선택
- Framework Preset: **Next.js**

### 4-3. Environment Variables 추가
Vercel 프로젝트 Settings → Environment Variables에 아래 값을 넣습니다.

- `DATABASE_URL`
- `DIRECT_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `ACCESS_TOKEN_TTL_MINUTES`
- `REFRESH_TOKEN_TTL_DAYS`
- `COOKIE_DOMAIN` (선택)

### 4-4. 배포 후 Prisma 마이그레이션
보통은 CI 또는 별도 로컬에서 아래를 실행합니다.

```bash
npx prisma migrate deploy
```

---

## 5. 현재 itpe-quiz와 맞춘 localSnapshot 형태

현재 `itpe-quiz/src/utils/storage.ts` 기준으로 최대한 맞춰둔 구조입니다.

```json
{
  "userState": {
    "starredIdsByExam": {
      "itpe": ["2020-1-001"],
      "bigdata": ["bigdata-2025-4-079"],
      "gov": []
    },
    "wrongIdsByExam": {
      "itpe": ["2020-1-010"],
      "bigdata": [],
      "gov": []
    },
    "examResults": [
      {
        "examId": "itpe",
        "year": 2025,
        "round": 1,
        "updatedAt": 1740000000000,
        "attempts": [
          {
            "attemptNo": 1,
            "score": 16,
            "total": 20,
            "passed": true,
            "wrongQids": ["2025-1-002"],
            "createdAt": 1740000000000
          }
        ]
      }
    ],
    "questionStatsByExam": {
      "itpe": {},
      "bigdata": {},
      "gov": {}
    }
  },
  "inProgress": {
    "examId": "itpe",
    "mode": "wrong",
    "deckIds": ["2025-1-001", "2025-1-002"],
    "index": 1,
    "activeExam": {
      "examId": "itpe",
      "year": 2025,
      "round": 1
    },
    "perQuestion": {
      "inputsByQid": {},
      "isCheckedByQid": {},
      "isCorrectByQid": {},
      "selectedChoiceByQid": {},
      "choiceCheckedByQid": {},
      "eliminatedChoiceNosByQid": {}
    },
    "examSessionWrongQids": [],
    "savedAt": 1740000000000
  }
}
```

---

## 6. 회원가입 시 로컬 기록 같이 보내는 예시

```ts
await fetch(`${API_URL}/api/auth/signup`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    email,
    password,
    nickname,
    deviceId,
    importVersion: 1,
    localSnapshot: {
      userState,
      inProgress,
    },
  }),
});
```

---

## 7. 로그인 예시

```ts
const res = await fetch(`${API_URL}/api/auth/login`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    email,
    password,
  }),
});

const data = await res.json();

// 모바일 권장
await SecureStore.setItemAsync("refreshToken", data.refreshToken);
```

---

## 8. 자동로그인 예시

```ts
const savedRefreshToken = await SecureStore.getItemAsync("refreshToken");

if (savedRefreshToken) {
  const res = await fetch(`${API_URL}/api/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      refreshToken: savedRefreshToken,
    }),
  });

  const data = await res.json();

  if (data.ok) {
    // 새 accessToken으로 사용자 상태 복구
  }
}
```

---

## 9. 주의점

### 1) 백엔드는 기기 AsyncStorage를 직접 읽지 못합니다
즉, “쿠키처럼 자동 수집”되는 것이 아니라,  
**앱이 기존 로컬 데이터를 읽어서 서버에 보내주는 방식**이어야 합니다.

### 2) `PUT /api/me/snapshot`은 merge 저장입니다
현재 구현은 전체 교체가 아니라 **병합 저장**입니다.  
나중에 앱 쪽 동기화 정책이 확정되면 replace 전략으로 바꿀 수 있습니다.

### 3) 운영에서는 refreshToken 본문 반환을 줄이고 싶을 수 있습니다
현재는 모바일 앱 편의상 JSON에도 refresh token을 넣어줍니다.  
웹만 대상으로 할 경우 cookie-only 방식으로 좁혀도 됩니다.

---

## 10. 다음 단계 추천

이 백엔드를 먼저 배포한 뒤,  
그 다음 `itpe-quiz` 앱에서 아래를 붙이면 됩니다.

1. 로그인/회원가입 화면 추가
2. 기존 AsyncStorage의 `userState`, `inProgress` 읽기
3. 회원가입 시 `localSnapshot` 포함해서 보내기
4. 로그인 성공 시 refresh token을 SecureStore에 저장
5. 앱 시작 시 `/api/auth/refresh` 호출
6. `/api/me/snapshot`으로 서버 저장 상태 불러오기

그 다음 단계에서 프론트까지 바로 붙여서 도와드리면 됩니다.
