"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { NoticeBanner } from "../../components/notice-banner";
import { useAuth } from "../../components/auth-provider";
import { Badge } from "../../components/ui-v2";
import { apiFetch } from "../../lib/api";

type Topic = {
  id: number;
  title: string;
  description: string | null;
  grade: number;
  createdAt: string;
};

type SubmissionItem = {
  id: number;
  createdAt: string;
  finalFeedback: string | null;
  topic: {
    id: number;
  };
};

type TopicStatus = "NOT_STARTED" | "SUBMITTED" | "FEEDBACK_READY";
type TopicFilter = "ALL" | "TODO" | "WAITING" | "DONE";

const topicStatusMeta: Record<
  TopicStatus,
  {
    label: string;
    description: string;
    badgeTone: "student" | "teacher" | "feedback";
    spineClass: string;
  }
> = {
  NOT_STARTED: {
    label: "미작성",
    description: "공책에 쓰거나 사진으로 올릴 수 있어요.",
    badgeTone: "student",
    spineClass: "bg-student-accent",
  },
  SUBMITTED: {
    label: "피드백 대기",
    description: "제출은 끝났고 피드백을 기다리고 있어요.",
    badgeTone: "teacher",
    spineClass: "bg-teacher-accent",
  },
  FEEDBACK_READY: {
    label: "피드백 완료",
    description: "선생님 피드백까지 확인할 수 있어요.",
    badgeTone: "feedback",
    spineClass: "bg-feedback-pen",
  },
};

const bookTiltClasses = [
  "-rotate-[1.2deg]",
  "rotate-[0.7deg]",
  "-rotate-[0.4deg]",
  "rotate-[1deg]",
  "-rotate-[0.8deg]",
  "rotate-[0.4deg]",
];

const bookCoverClasses = [
  "bg-student-soft",
  "bg-paper-surface",
  "bg-teacher-soft",
  "bg-feedback-soft",
  "bg-paper-base",
  "bg-paper-soft",
];

function formatTopicDate(createdAt: string) {
  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

function getTopicStatus(submission?: SubmissionItem): TopicStatus {
  if (!submission) {
    return "NOT_STARTED";
  }

  if (submission.finalFeedback) {
    return "FEEDBACK_READY";
  }

  return "SUBMITTED";
}

function matchesFilter(status: TopicStatus, filter: TopicFilter) {
  if (filter === "TODO") {
    return status === "NOT_STARTED";
  }

  if (filter === "WAITING") {
    return status === "SUBMITTED";
  }

  if (filter === "DONE") {
    return status === "FEEDBACK_READY";
  }

  return true;
}

function chunkCards<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

export default function StudentLibraryPage() {
  const { token, user, isReady } = useAuth();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  const [filter, setFilter] = useState<TopicFilter>("ALL");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      return;
    }

    let ignore = false;

    async function loadLibrary() {
      setIsLoading(true);
      setError("");

      try {
        const gradeQuery = user?.grade ? `?grade=${user.grade}` : "";
        const [nextTopics, nextSubmissions] = await Promise.all([
          apiFetch<Topic[]>(`/api/topics${gradeQuery}`, { token }),
          apiFetch<SubmissionItem[]>("/api/submissions", { token }),
        ]);

        if (ignore) {
          return;
        }

        setTopics(nextTopics);
        setSubmissions(nextSubmissions);
      } catch (loadError) {
        if (ignore) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "내 글쓰기 책장을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
        );
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void loadLibrary();

    return () => {
      ignore = true;
    };
  }, [token, user?.grade]);

  if (isReady && user?.role !== "STUDENT") {
    return <p className="rounded-xl bg-paper-surface p-6 shadow-sm">학생 계정만 접근할 수 있습니다.</p>;
  }

  const latestSubmissionByTopicId = new Map<number, SubmissionItem>();

  for (const submission of submissions) {
    if (!latestSubmissionByTopicId.has(submission.topic.id)) {
      latestSubmissionByTopicId.set(submission.topic.id, submission);
    }
  }

  const cards = topics.map((topic) => {
    const latestSubmission = latestSubmissionByTopicId.get(topic.id);
    const status = getTopicStatus(latestSubmission);

    return {
      id: topic.id,
      title: topic.title,
      description: topic.description,
      grade: topic.grade,
      createdAt: topic.createdAt,
      status,
      href: `/student/upload?topicId=${topic.id}`,
      actionLabel:
        status === "NOT_STARTED"
          ? "글 쓰러 가기"
          : status === "FEEDBACK_READY"
            ? "피드백 보기"
            : "공책 보기",
    };
  });

  const statusCounts = cards.reduce(
    (counts, card) => {
      counts[card.status] += 1;
      return counts;
    },
    {
      NOT_STARTED: 0,
      SUBMITTED: 0,
      FEEDBACK_READY: 0,
    } satisfies Record<TopicStatus, number>,
  );
  const filteredCards = cards.filter((card) => matchesFilter(card.status, filter));
  const firstTodoCard = cards.find((card) => card.status === "NOT_STARTED");
  const shelfRows = chunkCards(filteredCards, 3);
  const studentProfile = user?.studentProfile;
  const studentMeta = [
    studentProfile?.classroomName ? { label: "학급", value: studentProfile.classroomName } : null,
    studentProfile?.classCode ? { label: "코드", value: studentProfile.classCode } : null,
    studentProfile?.studentNumber ? { label: "번호", value: `${studentProfile.studentNumber}번` } : null,
    { label: "책", value: `${cards.length}권` },
  ].filter((item): item is { label: string; value: string } => Boolean(item));
  const filterTabs: Array<{ id: TopicFilter; label: string; count: number }> = [
    { id: "ALL", label: "전체", count: cards.length },
    { id: "TODO", label: "쓸 글", count: statusCounts.NOT_STARTED },
    { id: "WAITING", label: "피드백 대기", count: statusCounts.SUBMITTED },
    { id: "DONE", label: "완료", count: statusCounts.FEEDBACK_READY },
  ];

  return (
    <div className="overflow-hidden rounded-[28px] border border-ink-100 bg-paper-soft shadow-[0_1px_2px_rgba(60,40,20,.06),0_14px_34px_rgba(60,40,20,.08)]">
      <section className="bg-paper-surface bg-[radial-gradient(rgba(120,90,50,.06)_1px,transparent_1px)] bg-[length:24px_24px] px-8 pb-8 pt-9">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-student-accent">안녕, {user?.name ?? "친구"}!</p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-ink-900">내 책장</h1>
            <p className="kr-keep mt-3 max-w-2xl text-sm leading-6 text-ink-700">
              선생님이 낸 주제를 책처럼 모아두었어요. 공책에 쓴 글을 사진으로 올려도 괜찮고,
              바로 입력해서 제출해도 됩니다.
            </p>
          </div>
          <div className="grid w-full gap-2 rounded-xl border border-ink-100 bg-paper-soft/85 p-3 shadow-sm sm:grid-cols-2 lg:w-auto lg:min-w-[300px]">
            {studentMeta.map((item) => (
              <div key={item.label} className="rounded-lg border border-ink-100 bg-paper-surface px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-500">
                  {item.label}
                </p>
                <p className="mt-1 truncate text-sm font-bold text-ink-900">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {firstTodoCard ? (
          <div className="mt-7 flex flex-col gap-4 rounded-lg border border-student-soft border-l-[3px] border-l-student-accent bg-paper-surface px-5 py-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-student-accent/15 text-student-accent">
                <span className="text-lg font-bold">✎</span>
              </div>
              <div>
                <p className="kr-keep font-semibold text-ink-900">새로 써야 할 주제가 있어요</p>
                <p className="kr-keep mt-1 text-sm text-ink-700">
                  {firstTodoCard.title} · 공책에 쓰고 사진으로 톡 올릴 수 있어요.
                </p>
              </div>
            </div>
            <Link
              className="inline-flex min-h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-md bg-student-accent px-[18px] py-[13px] text-[15px] font-semibold text-paper-surface shadow-[0_1px_0_rgba(120,60,30,.15),0_2px_6px_rgba(180,90,50,.18)] hover:bg-student-accent/90"
              href={firstTodoCard.href}
            >
              글 쓰러 가기
            </Link>
          </div>
        ) : null}

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {["공책에 쓰기", "사진으로 올리기", "선생님 피드백 보기"].map((item, index) => (
            <div
              className="flex items-center gap-3 rounded-lg border border-ink-100 bg-paper-surface/80 px-4 py-3 text-sm font-semibold text-ink-800"
              key={item}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-student-soft text-xs font-bold text-student-deep">
                {index + 1}
              </span>
              {item}
            </div>
          ))}
        </div>

        <div className="mt-7 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="inline-flex w-fit rounded-md bg-paper-base p-1">
            {filterTabs.map((tab) => {
              const isActive = filter === tab.id;

              return (
                <button
                  key={tab.id}
                  className={`flex min-h-0 items-center gap-2 whitespace-nowrap rounded-md px-4 py-2 text-sm font-semibold shadow-none ${
                    isActive
                      ? "bg-paper-surface text-ink-900"
                      : "bg-transparent text-ink-700 hover:bg-paper-surface/60"
                  }`}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                >
                  {tab.label}
                  <span className="text-xs font-medium tabular-nums text-ink-500">{tab.count}</span>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-lg border border-ink-100 bg-paper-surface/80 px-4 py-3">
              <p className="text-xs text-ink-500">미작성</p>
              <p className="mt-1 font-semibold text-ink-900">{statusCounts.NOT_STARTED}</p>
            </div>
            <div className="rounded-lg border border-ink-100 bg-paper-surface/80 px-4 py-3">
              <p className="text-xs text-ink-500">대기</p>
              <p className="mt-1 font-semibold text-ink-900">{statusCounts.SUBMITTED}</p>
            </div>
            <div className="rounded-lg border border-ink-100 bg-paper-surface/80 px-4 py-3">
              <p className="text-xs text-ink-500">완료</p>
              <p className="mt-1 font-semibold text-ink-900">{statusCounts.FEEDBACK_READY}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="px-8 pb-10">
        {error ? (
          <div className="mt-6">
            <NoticeBanner tone="error" title="책장 불러오기 실패" description={error} />
          </div>
        ) : null}

        {isLoading ? (
          <div className="mt-7 rounded-xl border border-dashed border-ink-200 bg-paper-surface px-6 py-14 text-center text-sm text-ink-500">
            책장을 정리하는 중입니다...
          </div>
        ) : null}

        {!isLoading && cards.length === 0 ? (
          <div className="mt-7 rounded-xl border border-dashed border-ink-200 bg-paper-surface px-6 py-14 text-center">
            <div className="mx-auto mb-6 flex h-28 max-w-[260px] items-end justify-center gap-2 rounded-b-lg border-b-[10px] border-ink-200 bg-paper-soft px-6 pb-2">
              <span className="h-16 w-8 rounded-t-sm border border-dashed border-ink-200 bg-paper-surface" />
              <span className="h-20 w-8 rounded-t-sm border border-dashed border-student-accent/35 bg-student-soft/50" />
              <span className="h-14 w-8 rounded-t-sm border border-dashed border-teacher-accent/30 bg-teacher-soft/50" />
            </div>
            <p className="kr-keep text-lg font-semibold text-ink-900">첫 글이 곧 도착할 거예요</p>
            <p className="kr-keep mt-2 text-sm text-ink-700">
              선생님이 주제를 보내면 여기에 책처럼 쌓이고, 공책 사진으로 제출할 수 있어요.
            </p>
          </div>
        ) : null}

        {!isLoading && cards.length > 0 && filteredCards.length === 0 ? (
          <div className="mt-7 rounded-xl border border-dashed border-ink-200 bg-paper-surface px-6 py-14 text-center text-sm text-ink-700">
            <span className="kr-keep block">이 조건에 맞는 주제가 없습니다.</span>
          </div>
        ) : null}

        {!isLoading && filteredCards.length > 0 ? (
          <div className="mt-7 space-y-8">
            {shelfRows.map((row, rowIndex) => (
              <div key={rowIndex}>
                <div className="grid items-end gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {row.map((card, cardIndex) => {
                    const statusMeta = topicStatusMeta[card.status];
                    const absoluteIndex = rowIndex * 3 + cardIndex;
                    const tiltClass = bookTiltClasses[absoluteIndex % bookTiltClasses.length];
                    const coverClass =
                      card.status === "NOT_STARTED"
                        ? "border-dashed border-ink-200 bg-paper-soft"
                        : `${bookCoverClasses[absoluteIndex % bookCoverClasses.length]} border-ink-100`;
                    const hasFeedback = card.status === "FEEDBACK_READY";

                    return (
                      <Link
                        key={card.id}
                        href={card.href}
                        className={`group relative flex aspect-[5/7] min-h-[260px] flex-col overflow-hidden rounded-[6px_14px_14px_6px] border p-5 text-ink-900 shadow-[0_1px_2px_rgba(60,40,20,.08),0_12px_24px_rgba(60,40,20,.09)] transition duration-300 hover:-translate-y-1.5 hover:rotate-0 hover:shadow-[0_2px_4px_rgba(60,40,20,.1),0_18px_32px_rgba(60,40,20,.13)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-student-accent ${coverClass} ${tiltClass}`}
                      >
                        <span
                          aria-hidden
                          className={`absolute inset-y-0 left-0 w-2 ${statusMeta.spineClass} opacity-85 shadow-[inset_-1px_0_rgba(46,42,36,.16)]`}
                        />
                        <span
                          aria-hidden
                          className="absolute inset-y-0 left-3 w-px bg-paper-surface/70"
                        />
                        {hasFeedback ? (
                          <span className="absolute right-4 top-4 inline-flex h-3 w-3 rounded-full bg-feedback-pen shadow-[0_0_0_4px_rgba(58,111,176,.14)]">
                            <span className="sr-only">새 피드백 있음</span>
                          </span>
                        ) : null}
                        <div className="flex items-start justify-between gap-3 pl-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-500">
                            {formatTopicDate(card.createdAt)}
                          </p>
                          <Badge tone={statusMeta.badgeTone}>{statusMeta.label}</Badge>
                        </div>
                        <h2 className="kr-keep mt-5 line-clamp-3 pl-3 text-[22px] font-bold leading-[1.35]">
                          {card.title}
                        </h2>
                        <p className="kr-keep mt-4 line-clamp-3 pl-3 text-sm leading-6 text-ink-700">
                          {card.description || statusMeta.description}
                        </p>
                        <div className="mt-auto pl-3">
                          <div className="rounded-lg border border-ink-100 bg-paper-surface/70 px-4 py-3 shadow-[inset_0_1px_rgba(255,255,255,.45)]">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-500">
                              공책 라벨
                            </p>
                            <div className="mt-2 flex items-center justify-between gap-3">
                              <span className="text-sm font-semibold text-ink-900">{card.grade}학년</span>
                              <span className="whitespace-nowrap text-sm text-ink-700 group-hover:text-student-accent">
                                {card.actionLabel}
                              </span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
                <div className="relative mt-[-2px] h-4">
                  <div className="absolute inset-x-[-6px] top-0 h-2 rounded-b bg-[linear-gradient(180deg,#C9B998,#B49E72)] shadow-[0_4px_8px_rgba(80,55,25,.12)]" />
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
