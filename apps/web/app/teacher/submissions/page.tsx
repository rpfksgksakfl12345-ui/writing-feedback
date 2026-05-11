"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { NoticeBanner } from "../../../components/notice-banner";
import { useAuth } from "../../../components/auth-provider";
import { Badge } from "../../../components/ui-v2";
import { apiFetch } from "../../../lib/api";

type SubmissionItem = {
  id: number;
  inputType: "TYPED" | "PHOTO";
  imageUrl: string | null;
  status: "PENDING" | "REVIEWED";
  finalFeedback: string | null;
  createdAt: string;
  student: { name: string; grade: number | null };
  topic: { title: string; grade: number };
};

type ClassroomSummary = {
  id: number;
};

type TopicSummary = {
  id: number;
};

function getStatusMeta(status: SubmissionItem["status"]) {
  if (status === "REVIEWED") {
    return {
      label: "피드백 완료",
      tone: "feedback" as const,
      description: "학생에게 보낼 피드백이 저장되었습니다.",
    };
  }

  return {
    label: "피드백 대기",
    tone: "student" as const,
    description: "교사 검토와 최종 피드백 작성이 필요합니다.",
  };
}

function formatSubmissionDate(createdAt: string) {
  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    return "제출 시점 정보 없음";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function TeacherSubmissionsContent() {
  const searchParams = useSearchParams();
  const { token, user, isReady } = useAuth();
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  const [classrooms, setClassrooms] = useState<ClassroomSummary[]>([]);
  const [topics, setTopics] = useState<TopicSummary[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const saved = searchParams.get("saved") === "1";

  useEffect(() => {
    if (!token) {
      return;
    }

    let ignore = false;
    setIsLoading(true);
    setError("");

    Promise.all([
      apiFetch<SubmissionItem[]>("/api/submissions", { token }),
      apiFetch<ClassroomSummary[]>("/api/classrooms", { token }),
      apiFetch<TopicSummary[]>("/api/topics", { token }),
    ])
      .then(([nextSubmissions, nextClassrooms, nextTopics]) => {
        if (!ignore) {
          setSubmissions(nextSubmissions);
          setClassrooms(nextClassrooms);
          setTopics(nextTopics);
        }
      })
      .catch((loadError) => {
        if (!ignore) {
          setError(loadError instanceof Error ? loadError.message : "제출물을 불러오지 못했습니다.");
        }
      })
      .finally(() => {
        if (!ignore) {
          setIsLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [token]);

  if (isReady && user?.role !== "TEACHER") {
    return (
      <section className="rounded-xl border border-ink-100 bg-paper-surface p-6 text-ink-700 shadow-sm">
        교사 계정만 접근할 수 있습니다.
      </section>
    );
  }

  const pendingCount = submissions.filter((submission) => submission.status === "PENDING").length;
  const reviewedCount = submissions.filter((submission) => submission.status === "REVIEWED").length;
  const photoCount = submissions.filter((submission) => submission.inputType === "PHOTO").length;
  const hasClassrooms = classrooms.length > 0;
  const hasTopics = topics.length > 0;
  const emptyState = !hasClassrooms
    ? {
        title: "먼저 학급을 만들어주세요",
        description:
          "학급을 만들면 학생 계정을 발급하고, 학생들이 글을 제출할 주제를 보낼 수 있어요.",
        href: "/teacher/classrooms",
        action: "학급 만들러 가기",
      }
    : !hasTopics
      ? {
          title: "아직 글쓰기 주제가 없어요",
          description:
            "학급은 준비됐습니다. 첫 주제를 만들면 학생들이 책장에서 글쓰기를 시작할 수 있어요.",
          href: "/teacher/topics",
          action: "주제 만들러 가기",
        }
      : {
          title: "아직 검토할 글이 없어요",
          description:
            "학생들이 글을 제출하면 이곳에서 읽고 피드백을 남길 수 있어요.",
          href: null,
          action: null,
        };

  return (
    <div className="overflow-hidden rounded-[28px] border border-ink-100 bg-paper-soft shadow-[0_1px_2px_rgba(60,40,20,.06),0_14px_34px_rgba(60,40,20,.08)]">
      <section className="bg-paper-surface bg-[radial-gradient(rgba(90,110,133,.07)_1px,transparent_1px)] bg-[length:24px_24px] px-8 pb-7 pt-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-sm font-semibold text-teacher-accent">교사 피드백</p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-ink-900">제출물 목록</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-700">
              학생이 제출한 글과 사진을 확인하고, 피드백 작성이 필요한 항목을 빠르게 찾습니다.
            </p>
          </div>

          <Link
            className="inline-flex min-h-11 w-fit items-center justify-center whitespace-nowrap rounded-md border border-ink-100 bg-paper-surface px-[18px] py-[13px] text-[15px] font-semibold text-ink-900 hover:bg-paper-base"
            href="/teacher/topics"
          >
            주제 관리로 이동
          </Link>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-ink-100 bg-paper-surface/85 px-4 py-3">
            <p className="text-xs text-ink-500">전체 제출</p>
            <p className="mt-1 text-lg font-semibold text-ink-900">{submissions.length}</p>
          </div>
          <div className="rounded-lg border border-ink-100 bg-paper-surface/85 px-4 py-3">
            <p className="text-xs text-ink-500">피드백 대기</p>
            <p className="mt-1 text-lg font-semibold text-student-accent">{pendingCount}</p>
          </div>
          <div className="rounded-lg border border-ink-100 bg-paper-surface/85 px-4 py-3">
            <p className="text-xs text-ink-500">피드백 완료</p>
            <p className="mt-1 text-lg font-semibold text-feedback-pen">{reviewedCount}</p>
          </div>
          <div className="rounded-lg border border-ink-100 bg-paper-surface/85 px-4 py-3">
            <p className="text-xs text-ink-500">사진 제출</p>
            <p className="mt-1 text-lg font-semibold text-teacher-accent">{photoCount}</p>
          </div>
        </div>
      </section>

      <section className="px-8 pb-10 pt-7">
        {saved ? (
          <div className="mb-5">
            <NoticeBanner
              tone="success"
              title="피드백 저장 완료"
              description="저장 후 다시 제출물 목록으로 돌아왔습니다."
            />
          </div>
        ) : null}

        {error ? (
          <div className="mb-5">
            <NoticeBanner tone="error" title="제출물 불러오기 실패" description={error} />
          </div>
        ) : null}

        {isLoading ? (
          <div className="rounded-xl border border-dashed border-ink-200 bg-paper-surface px-6 py-14 text-center text-sm text-ink-500">
            제출물을 불러오는 중입니다...
          </div>
        ) : null}

        {!isLoading && submissions.length === 0 ? (
          <div className="kr-keep rounded-xl border border-dashed border-ink-200 bg-paper-surface px-6 py-14 text-center">
            <p className="text-lg font-semibold text-ink-900">{emptyState.title}</p>
            <p className="mx-auto mt-2 max-w-[560px] text-sm leading-6 text-ink-700">
              {emptyState.description}
            </p>
            {emptyState.href && emptyState.action ? (
              <Link
                className="mt-5 inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-md bg-teacher-accent px-[18px] py-[13px] text-[15px] font-semibold text-paper-surface hover:bg-teacher-accent/90"
                href={emptyState.href}
              >
                {emptyState.action}
              </Link>
            ) : null}
          </div>
        ) : null}

        {!isLoading && submissions.length > 0 ? (
          <div className="space-y-4">
            {submissions.map((submission) => {
              const statusMeta = getStatusMeta(submission.status);
              const hasFinalFeedback = Boolean(submission.finalFeedback);
              const isPending = submission.status === "PENDING";

              return (
                <article
                  key={submission.id}
                  className={`grid gap-5 overflow-hidden rounded-xl border bg-paper-surface p-0 shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_12px_26px_rgba(60,40,20,.09)] lg:grid-cols-[1fr_auto] ${
                    isPending
                      ? "border-feedback-pen/25 border-l-[4px] border-l-feedback-pen"
                      : "border-ink-100 border-l-[4px] border-l-status-feedbackDone"
                  }`}
                >
                  <div className="min-w-0 p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
                      <Badge tone={hasFinalFeedback ? "feedback" : "neutral"}>
                        {hasFinalFeedback ? "최종 피드백 있음" : "최종 피드백 없음"}
                      </Badge>
                    </div>

                    <h2 className="mt-3 text-[20px] font-bold leading-tight text-ink-900">
                      {submission.topic.title}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-ink-700">
                      {submission.student.name} / {submission.student.grade ?? "-"}학년 /{" "}
                      {submission.topic.grade}학년 주제
                    </p>
                    <p className="mt-1 text-sm text-ink-500">
                      {formatSubmissionDate(submission.createdAt)} · {statusMeta.description}
                    </p>
                  </div>

                  <div className="flex items-start bg-paper-base/45 p-5 lg:items-center">
                    <Link
                      className={`inline-flex min-h-11 w-full items-center justify-center whitespace-nowrap rounded-md px-[18px] py-[13px] text-[15px] font-semibold text-paper-surface shadow-[0_1px_0_rgba(40,60,90,.15),0_2px_6px_rgba(60,80,120,.18)] lg:w-auto ${
                        isPending
                          ? "bg-teacher-accent hover:bg-teacher-accent/90"
                          : "bg-feedback-pen hover:bg-feedback-pen/90"
                      }`}
                      href={`/teacher/submissions/${submission.id}`}
                    >
                      {isPending ? "피드백 작성" : "다시 보기"}
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </section>
    </div>
  );
}

export default function TeacherSubmissionsPage() {
  return (
    <Suspense
      fallback={
        <section className="rounded-xl border border-ink-100 bg-paper-surface p-6 text-ink-700 shadow-sm">
          불러오는 중...
        </section>
      }
    >
      <TeacherSubmissionsContent />
    </Suspense>
  );
}
