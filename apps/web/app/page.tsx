import Link from "next/link";

export default function HomePage() {
  const flowSteps = [
    {
      label: "1",
      title: "공책에 쓰기",
      description: "학생은 평소처럼 연필로 생각을 적습니다.",
    },
    {
      label: "2",
      title: "사진으로 톡 제출하기",
      description: "공책 사진을 올리거나 바로 입력해 제출합니다.",
    },
    {
      label: "3",
      title: "담임 피드백 완성하기",
      description: "AI 초안을 참고하고 선생님이 담임 피드백을 남깁니다.",
    },
  ];

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-2xl border border-ink-100 bg-paper-surface shadow-[0_1px_2px_rgba(60,40,20,.06),0_14px_34px_rgba(60,40,20,.08)]">
        <div className="grid gap-8 px-6 py-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:px-10 lg:py-10">
          <div className="flex min-h-[520px] flex-col justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-student-accent/25 bg-student-soft px-3 py-1 text-sm font-semibold text-student-deep">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-paper-surface text-xs font-bold">
                  톡
                </span>
                공책톡톡
              </div>
              <h1 className="kr-keep mt-6 max-w-3xl text-[40px] font-bold leading-[1.18] text-ink-900 sm:text-[52px]">
                손글씨 공책과 AI 피드백을 연결하는 초등 글쓰기 도구
              </h1>
              <p className="kr-keep mt-5 max-w-2xl text-base leading-7 text-ink-700">
                학생은 평소처럼 공책에 쓰고, 선생님은 사진 제출, 글 확인, AI 초안,
                담임 피드백 흐름으로 우리 반 글쓰기를 관리합니다.
              </p>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {flowSteps.map((step) => (
                <article
                  className="rounded-lg border border-ink-100 bg-paper-soft p-4 shadow-sm"
                  key={step.title}
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-md bg-student-accent text-sm font-bold text-paper-surface">
                    {step.label}
                  </span>
                  <h2 className="kr-keep mt-4 text-base font-bold text-ink-900">{step.title}</h2>
                  <p className="kr-keep mt-2 text-sm leading-6 text-ink-700">{step.description}</p>
                </article>
              ))}
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-md bg-teacher-accent px-5 py-3 text-sm font-semibold text-paper-surface shadow-sm hover:bg-teacher-accent/90"
                href="/login"
              >
                우리 반으로 들어가기
              </Link>
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-ink-100 bg-paper-surface px-5 py-3 text-sm font-semibold text-ink-900 hover:bg-paper-base"
                href="/register"
              >
                교사 계정 만들기
              </Link>
            </div>
          </div>

          <div className="rounded-xl border border-ink-100 bg-paper-soft p-5 shadow-sm">
            <div className="rounded-lg border border-ink-100 bg-paper-surface p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-500">
                교실 글쓰기 흐름
              </p>
              <div className="mt-5 space-y-3">
                {["공책 사진 제출", "사진 속 글 확인", "AI 초안 참고", "담임 피드백 저장"].map(
                  (item, index) => (
                    <div
                      className="flex items-center gap-3 rounded-lg border border-ink-100 bg-paper-base/60 px-4 py-3"
                      key={item}
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-teacher-soft text-xs font-bold text-teacher-accent">
                        {index + 1}
                      </span>
                      <span className="text-sm font-semibold text-ink-900">{item}</span>
                    </div>
                  ),
                )}
              </div>
            </div>

            <div className="mt-4 grid gap-4">
              <div className="rounded-lg border border-feedback-pen/20 bg-feedback-soft px-4 py-4">
                <p className="text-sm font-bold text-feedback-pen">교사용 가치</p>
                <p className="kr-keep mt-2 text-sm leading-6 text-ink-700">
                  수합과 초안 피드백 시간을 줄이고, 담임의 최종 판단은 남깁니다.
                </p>
              </div>
              <div className="rounded-lg border border-student-accent/20 bg-student-soft px-4 py-4">
                <p className="text-sm font-bold text-student-deep">학생용 가치</p>
                <p className="kr-keep mt-2 text-sm leading-6 text-ink-700">
                  주제 설명, 생각 질문, 첫 문장 힌트로 글쓰기의 막막함을 줄입니다.
                </p>
              </div>
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
            title: "우리 반 맥락을 봅니다",
            description: "학년, 시기, 학교 일정에 맞는 글쓰기 주제를 추천받을 수 있어요.",
          },
        ].map((item) => (
          <article className="rounded-lg border border-ink-100 bg-paper-surface p-5 shadow-sm" key={item.title}>
            <h2 className="kr-keep text-lg font-bold text-ink-900">{item.title}</h2>
            <p className="kr-keep mt-2 text-sm leading-6 text-ink-700">{item.description}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
