import Link from "next/link";

export default function HomePage() {
  const flowSteps = [
    "공책 사진 제출",
    "글 확인",
    "피드백 준비",
    "담임 피드백 저장",
  ];

  const contextBadges = ["학교 일정 참고", "공책 사진 제출", "글 확인", "담임 피드백"];

  return (
    <div className="space-y-8">
      <section className="w-full max-w-full overflow-hidden rounded-[28px] border border-ink-100 bg-paper-surface shadow-[0_1px_2px_rgba(60,40,20,.06),0_14px_34px_rgba(60,40,20,.08)]">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-7 px-6 py-7 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,.85fr)] lg:px-10 lg:py-9">
          <div className="flex min-h-[500px] min-w-0 flex-col justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-student-accent/25 bg-student-soft px-3 py-1 text-sm font-semibold text-student-deep">
                <span
                  aria-hidden="true"
                  className="flex h-6 w-6 items-center justify-center rounded-md bg-paper-surface shadow-[inset_0_0_0_1px_rgba(180,130,70,.18)]"
                >
                  <span className="h-2.5 w-2.5 rounded-full bg-student-accent shadow-[7px_0_0_rgba(95,139,122,.35)]" />
                </span>
                공책 사진부터 담임 피드백까지
              </div>

              <h1 className="font-brand-logo kr-keep mt-5 text-[54px] font-bold leading-none text-ink-900 sm:text-[72px]">
                공책톡톡
              </h1>
              <p className="font-brand-headline kr-keep mt-4 max-w-3xl text-[30px] font-semibold leading-[1.28] text-ink-900 sm:text-[40px]">
                <span className="block">학교 일정은 글감으로,</span>
                <span className="block">공책 글은 피드백으로.</span>
              </p>
              <p className="font-brand-copy kr-keep mt-3 max-w-[560px] text-sm font-normal leading-relaxed text-ink-700 sm:text-base">
                손글씨 공책과 AI 피드백을 연결하는 초등 글쓰기 도구
              </p>
              <p className="font-brand-copy kr-keep mt-4 max-w-2xl text-base leading-relaxed text-ink-700 sm:text-lg">
                <span className="font-semibold text-teacher-deep">학교 일정</span>과{" "}
                <span className="font-semibold text-teacher-deep">우리 반 활동</span>을
                글쓰기 주제로 연결하고,
                <span className="block sm:inline">
                  {" "}
                  학생이 <span className="font-semibold text-student-deep">공책에 쓴 글</span>을
                  사진으로 올리면{" "}
                  <span className="font-semibold text-teacher-deep">선생님의 피드백</span>으로
                  이어집니다.
                </span>
              </p>

              <div className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                {contextBadges.map((badge) => (
                  <span
                    className="font-brand-copy rounded-full border border-ink-100 bg-paper-soft px-3 py-1 text-center text-xs font-medium text-ink-700"
                    key={badge}
                  >
                    {badge}
                  </span>
                ))}
              </div>

              <div className="kr-keep mt-5 rounded-xl border border-teacher-accent/20 bg-teacher-soft/55 p-4">
                <p className="font-brand-headline text-sm font-semibold text-teacher-deep">
                  우리 반 오늘의 경험이 글쓰기 주제가 됩니다
                </p>
                <p className="font-brand-copy mt-2 text-sm leading-6 text-ink-700">
                  <span className="block">학교 일정과 교실 경험을 주제 만들기에 참고합니다.</span>
                  <span className="block">체육대회와 현장체험학습을 글감으로 연결할 수 있어요.</span>
                </p>
              </div>
            </div>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-md bg-teacher-accent px-5 py-3 text-sm font-semibold text-paper-surface shadow-sm hover:bg-teacher-accent/90"
                href="/login"
              >
                공책톡톡 시작하기
              </Link>
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-ink-100 bg-paper-surface px-5 py-3 text-sm font-semibold text-ink-900 hover:bg-paper-base"
                href="/register"
              >
                교사 계정 만들기
              </Link>
            </div>
          </div>

          <div className="min-w-0 rounded-xl border border-ink-100 bg-paper-soft p-5 shadow-sm">
            <div className="rounded-lg border border-ink-100 bg-paper-surface p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-500">
                교실 글쓰기 흐름
              </p>
              <h2 className="font-brand-headline kr-keep mt-2 text-xl font-semibold text-ink-900">
                공책에서 피드백까지 한 번에 이어집니다
              </h2>
              <div className="mt-5 space-y-3">
                {flowSteps.map((item, index) => (
                  <div
                    className="flex items-center gap-3 rounded-lg border border-ink-100 bg-paper-base/60 px-4 py-3"
                    key={item}
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-teacher-soft text-xs font-bold text-teacher-accent">
                      {index + 1}
                    </span>
                    <span className="font-brand-copy text-sm font-medium text-ink-900">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 grid gap-4">
              <div className="rounded-lg border border-feedback-pen/20 bg-feedback-soft px-4 py-4">
                <p className="font-brand-headline text-sm font-semibold text-feedback-pen">교사용 가치</p>
                <p className="font-brand-copy kr-keep mt-2 text-sm leading-6 text-ink-700">
                  수합과 초안 피드백 시간을 줄이고, 담임의 최종 판단은 남깁니다.
                </p>
              </div>
              <div className="rounded-lg border border-student-accent/20 bg-student-soft px-4 py-4">
                <p className="font-brand-headline text-sm font-semibold text-student-deep">학생용 가치</p>
                <p className="font-brand-copy kr-keep mt-2 text-sm leading-6 text-ink-700">
                  주제 설명, 생각 질문, 첫 문장 힌트로 글쓰기의 막막함을 줄입니다.
                </p>
              </div>
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-teacher-accent/20 bg-paper-surface px-5 py-3 text-sm font-semibold text-teacher-deep hover:bg-teacher-soft"
                href="/login"
              >
                우리 반 글쓰기 시작하기
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          {
            title: "손글씨도 괜찮아요",
            description: "공책 사진으로 글을 올리면 선생님이 글을 확인할 수 있어요.",
          },
          {
            title: "AI는 초안만 돕습니다",
            description: "AI가 대신 평가하지 않고, 담임 피드백을 더 빠르게 준비합니다.",
          },
          {
            title: "학교 일정까지 살펴요",
            description:
              "학교 일정이 있으면 글감으로 연결하고, 일정이 없어도 학년과 시기에 맞게 추천합니다.",
          },
        ].map((item) => (
          <article className="rounded-lg border border-ink-100 bg-paper-surface p-5 shadow-sm" key={item.title}>
            <h2 className="font-brand-headline kr-keep text-lg font-semibold text-ink-900">{item.title}</h2>
            <p className="font-brand-copy kr-keep mt-2 text-sm leading-6 text-ink-700">{item.description}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
