export default function HomePage() {
  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "48px 24px", lineHeight: 1.7 }}>
      <h1>itpe-quiz auth backend</h1>
      <p>이 프로젝트는 Vercel 배포를 전제로 만든 Next.js + Prisma + Postgres 기반 인증/기록 저장 백엔드입니다.</p>
      <ul>
        <li>회원가입 / 로그인 / 자동로그인(Refresh Token)</li>
        <li>회원가입 시 로컬 AsyncStorage 기록 1회 가져오기</li>
        <li>별표, 오답, 시험기록, 이어풀기 저장</li>
        <li>현재 itpe-quiz의 storage.ts 구조와 최대한 맞춘 snapshot API 포함</li>
      </ul>
      <p>루트 페이지는 안내용이며, 실제 기능은 <code>/api/*</code> 아래에서 동작합니다.</p>
    </main>
  );
}
