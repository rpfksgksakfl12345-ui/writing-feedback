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
    description: "아직 제출한 글이 없어요.",
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
    return <p className="rounded-xl bg-[#FFFAF0] p-6 shadow-sm">학생 계정만 접근할 수 있습니다.</p>;
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
  const filterTabs: Array<{ id: TopicFilter; label: string; count: number }> = [
    { id: "ALL", label: "전체", count: cards.length },
    { id: "TODO", label: "해야 할 글", count: statusCounts.NOT_STARTED },
    { id: "WAITING", label: "피드백 대기", count: statusCounts.SUBMITTED },
    { id: "DONE", label: "완료", count: statusCounts.FEEDBACK_READY },
  ];

  return (
    <div className="overflow-hidden rounded-[28px] border border-[#E8DEC7] bg-paper-base shadow-sm">
      <section className="bg-[radial-gradient(rgba(120,90,50,.04)_1px,transparent_1px)] bg-[length:24px_24px] px-8 pb-8 pt-9">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-student-accent">안녕, {user?.name ?? "친구"}!</p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-[#2E2A24]">내 책장</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#5A5247]">
              선생님이 낸 글쓰기 주제를 책처럼 모아두었어요. 카드를 열면 바로 글쓰기 화면에서
              이어서 제출할 수 있습니다.
            </p>
          </div>

          <div className="text-left text-sm text-[#8B8170] lg:text-right">
            <p>
              <span className="font-semibold text-[#2E2A24]">{cards.length}</span>편의 글쓰기 주제
            </p>
            <p className="mt-1 text-xs text-[#A89C85]">
              {user?.grade ? `${user.grade}학년 주제만 보여요` : "학년 정보가 있는 주제를 보여요"}
            </p>
          </div>
        </div>

        {firstTodoCard ? (
          <div className="mt-7 flex flex-col gap-4 rounded-lg border border-[#F0DCC2] border-l-[3px] border-l-student-accent bg-[#FFFAF0] px-5 py-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-student-accent/15 text-student-accent">
                <span className="text-lg font-bold">✎</span>
              </div>
              <div>
                <p className="font-semibold text-[#2E2A24]">새로 써야 할 주제가 있어요</p>
                <p className="mt-1 text-sm text-[#5A5247]">
                  {firstTodoCard.title} · {formatTopicDate(firstTodoCard.createdAt)}
                </p>
              </div>
            </div>
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-student-accent px-[18px] py-[13px] text-[15px] font-semibold text-[#FFFAF0] shadow-[0_1px_0_rgba(120,60,30,.15),0_2px_6px_rgba(180,90,50,.18)] hover:bg-student-accent/90"
              href={firstTodoCard.href}
            >
              시작하기
            </Link>
          </div>
        ) : null}

        <div className="mt-7 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="inline-flex w-fit rounded-md bg-[#F4ECDC] p-1">
            {filterTabs.map((tab) => {
              const isActive = filter === tab.id;

              return (
                <button
                  key={tab.id}
                  className={`flex min-h-0 items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold shadow-none ${
                    isActive
                      ? "bg-[#FFFAF0] text-[#2E2A24]"
                      : "bg-transparent text-[#5A5247] hover:bg-[#FFFAF0]/60"
                  }`}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                >
                  {tab.label}
                  <span className="text-xs font-medium tabular-nums text-[#8B8170]">{tab.count}</span>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-lg border border-[#E8DEC7] bg-[#FFFAF0]/80 px-4 py-3">
              <p className="text-xs text-[#8B8170]">미작성</p>
              <p className="mt-1 font-semibold text-[#2E2A24]">{statusCounts.NOT_STARTED}</p>
            </div>
            <div className="rounded-lg border border-[#E8DEC7] bg-[#FFFAF0]/80 px-4 py-3">
              <p className="text-xs text-[#8B8170]">대기</p>
              <p className="mt-1 font-semibold text-[#2E2A24]">{statusCounts.SUBMITTED}</p>
            </div>
            <div className="rounded-lg border border-[#E8DEC7] bg-[#FFFAF0]/80 px-4 py-3">
              <p className="text-xs text-[#8B8170]">완료</p>
              <p className="mt-1 font-semibold text-[#2E2A24]">{statusCounts.FEEDBACK_READY}</p>
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
          <div className="mt-7 rounded-xl border border-dashed border-[#C9B998] bg-[#FFFAF0] px-6 py-14 text-center text-sm text-[#8B8170]">
            책장을 정리하는 중입니다...
          </div>
        ) : null}

        {!isLoading && cards.length === 0 ? (
          <div className="mt-7 rounded-xl border border-dashed border-[#C9B998] bg-[#FFFAF0] px-6 py-14 text-center">
            <p className="text-lg font-semibold text-[#2E2A24]">첫 글이 곧 도착할 거예요</p>
            <p className="mt-2 text-sm text-[#5A5247]">
              선생님이 주제를 보내면 여기에 책처럼 쌓입니다.
            </p>
          </div>
        ) : null}

        {!isLoading && cards.length > 0 && filteredCards.length === 0 ? (
          <div className="mt-7 rounded-xl border border-dashed border-[#C9B998] bg-[#FFFAF0] px-6 py-14 text-center text-sm text-[#5A5247]">
            이 조건에 맞는 주제가 없습니다.
          </div>
        ) : null}

        {!isLoading && filteredCards.length > 0 ? (
          <div className="mt-7 space-y-8">
            {shelfRows.map((row, rowIndex) => (
              <div key={rowIndex}>
                <div className="grid items-end gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {row.map((card, cardIndex) => {
                    const statusMeta = topicStatusMeta[card.status];
                    const tiltClass = bookTiltClasses[(rowIndex * 3 + cardIndex) % bookTiltClasses.length];

                    return (
                      <Link
                        key={card.id}
                        href={card.href}
                        className={`group relative flex min-h-[260px] flex-col overflow-hidden rounded-[6px_12px_12px_6px] border border-[#E8DEC7] bg-[#FFFAF0] p-5 text-[#2E2A24] shadow-[0_1px_2px_rgba(60,40,20,.08),0_10px_22px_rgba(60,40,20,.07)] transition hover:-translate-y-1 hover:rotate-0 hover:shadow-[0_2px_4px_rgba(60,40,20,.1),0_18px_30px_rgba(60,40,20,.12)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-student-accent ${tiltClass}`}
                      >
                        <span
                          aria-hidden
                          className={`absolute inset-y-0 left-0 w-2 ${statusMeta.spineClass} opacity-80`}
                        />
                        <div className="flex items-start justify-between gap-3 pl-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B8170]">
                            {formatTopicDate(card.createdAt)}
                          </p>
                          <Badge tone={statusMeta.badgeTone}>{statusMeta.label}</Badge>
                        </div>
                        <h2 className="mt-5 line-clamp-3 pl-3 text-[22px] font-bold leading-tight">
                          {card.title}
                        </h2>
                        <p className="mt-4 line-clamp-3 pl-3 text-sm leading-6 text-[#5A5247]">
                          {card.description || statusMeta.description}
                        </p>
                        <div className="mt-auto pl-3">
                          <div className="rounded-lg border border-[#E8DEC7] bg-paper-base/60 px-4 py-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B8170]">
                              진행 상태
                            </p>
                            <div className="mt-2 flex items-center justify-between gap-3">
                              <span className="text-sm font-semibold text-[#2E2A24]">{card.grade}학년</span>
                              <span className="text-sm text-[#5A5247] group-hover:text-student-accent">
                                열기
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
