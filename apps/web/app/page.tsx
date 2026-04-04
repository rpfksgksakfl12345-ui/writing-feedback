import Link from "next/link";

export default function HomePage() {
  return (
    <section className="rounded-xl bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-semibold">초등학생 글쓰기 피드백 웹앱</h1>
      <p className="mt-3 text-sm text-slate-600">
        교사는 주제를 만들고 피드백을 남기고, 학생은 글쓰기 사진을 업로드하고 기록을 확인합니다.
      </p>
      <div className="mt-6 flex gap-3">
        <Link className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white" href="/login">
          로그인하기
        </Link>
        <Link className="rounded-md bg-slate-200 px-4 py-2 text-sm" href="/teacher/topics">
          교사 화면 보기
        </Link>
      </div>
    </section>
  );
}
