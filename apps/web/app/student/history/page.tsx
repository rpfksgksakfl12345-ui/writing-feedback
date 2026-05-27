"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { NoticeBanner } from "../../../components/notice-banner";
import { useAuth } from "../../../components/auth-provider";
import { Badge } from "../../../components/ui-v2";
import { apiFetch } from "../../../lib/api";

type SubmissionItem = {
  id: number;
  inputType: "TYPED" | "PHOTO";
  status: "PENDING" | "REVIEWED";
  finalFeedback: string | null;
  createdAt: string;
  topic: { id: number; title: string };
};

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

function getInputTypeLabel(inputType: SubmissionItem["inputType"]) {
  return inputType === "TYPED" ? "직접 입력" : "공책 사진";
}

function getStatusMeta(status: SubmissionItem["status"]) {
  if (status === "REVIEWED") {
    return {
      label: "피드백 완료",
      tone: "feedback" as const,
      description: "선생님 피드백이 도착했어요.",
    };
  }

  return {
    label: "피드백 대기",
    tone: "teacher" as const,
    description: "선생님이 글을 확인하고 있어요.",
  };
}

export default function StudentHistoryPage() {
  const { token, user, isReady } = useAuth();
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      return;
    }

    apiFetch<SubmissionItem[]>("/api/submissions", { token })
      .then(setSubmissions)
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : "기록을 불러오지 못했습니다.");
      });
  }, [token]);

  if (isReady && user?.role !== "STUDENT") {
    return (
      <section className="rounded-xl border border-ink-100 bg-paper-surface p-6 text-ink-700 shadow-sm">
        학생 계정만 접근할 수 있습니다.
      </section>
    );
  }

  const pendingCount = submissions.filter((submission) => submission.status === "PENDING").length;
  const reviewedCount = submissions.filter((submission) => submission.status === "REVIEWED").length;

  return (
    <div className="overflow-hidden rounded-[28px] border border-ink-100 bg-paper-soft shadow-[0_1px_2px_rgba(60,40,20,.06),0_14px_34px_rgba(60,40,20,.08)]">
      <section className="bg-paper-surface bg-[radial-gradient(rgba(120,90,50,.06)_1px,transparent_1px)] bg-[length:24px_24px] px-8 pb-7 pt-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-student-accent">
              {user?.name ? `${user.name}의 글쓰기` : "학생 글쓰기"}
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-ink-900">
              내 글과 피드백
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-700">
              내가 올린 공책과 선생님 피드백 상태를 한눈에 봅니다. 피드백이 도착한 글은 바로 열어 확인할 수 있어요.
            </p>
          </div>

          <Link
            className="inline-flex min-h-11 w-fit shrink-0 items-center justify-center whitespace-nowrap rounded-md bg-student-accent px-[18px] py-[13px] text-[15px] font-semibold text-paper-surface shadow-[0_1px_0_rgba(120,60,30,.15),0_2px_6px_rgba(180,90,50,.18)] hover:bg-student-accent/90"
            href="/student"
          >
            내 책장으로 가기
          </Link>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-ink-100 bg-paper-surface/80 px-4 py-3">
            <p className="text-xs text-ink-500">전체 제출</p>
            <p className="mt-1 text-lg font-semibold text-ink-900">{submissions.length}</p>
          </div>
          <div className="rounded-lg border border-ink-100 bg-paper-surface/80 px-4 py-3">
            <p className="text-xs text-ink-500">피드백 대기</p>
            <p className="mt-1 text-lg font-semibold text-ink-900">{pendingCount}</p>
          </div>
          <div className="rounded-lg border border-ink-100 bg-paper-surface/80 px-4 py-3">
            <p className="text-xs text-ink-500">피드백 완료</p>
            <p className="mt-1 text-lg font-semibold text-feedback-pen">{reviewedCount}</p>
          </div>
        </div>
      </section>

      <section className="px-8 pb-10 pt-7">
        {error ? (
          <div className="mb-5">
            <NoticeBanner tone="error" title="기록 불러오기 실패" description={error} />
          </div>
        ) : null}

        <div className="space-y-3">
          {submissions.map((submission) => {
            const statusMeta = getStatusMeta(submission.status);

            return (
              <article
                key={submission.id}
                className="rounded-xl border border-ink-100 bg-paper-surface p-5 shadow-sm"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="student">{getInputTypeLabel(submission.inputType)}</Badge>
                      <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
                      {submission.finalFeedback ? <Badge tone="feedback">피드백 있음</Badge> : null}
                    </div>
                    <h2 className="mt-3 text-xl font-bold leading-tight text-ink-900">
                      {submission.topic.title}
                    </h2>
                    <p className="mt-2 text-sm text-ink-500">
                      {formatSubmissionDate(submission.createdAt)} · {statusMeta.description}
                    </p>
                  </div>
                  <Link
                    className="inline-flex min-h-10 w-fit shrink-0 items-center justify-center whitespace-nowrap rounded-md border border-ink-100 bg-paper-surface px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-paper-base"
                    href={`/student/upload?topicId=${submission.topic.id}`}
                  >
                    {submission.finalFeedback ? "선생님 피드백 보기" : "제출한 글 보기"}
                  </Link>
                </div>
              </article>
            );
          })}

          {submissions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-ink-200 bg-paper-surface px-6 py-14 text-center">
              <p className="text-lg font-semibold text-ink-900">아직 올린 공책이 없어요.</p>
              <p className="mt-2 text-sm text-ink-700">
                책장에서 주제를 고른 뒤 공책 사진으로 올리거나 직접 입력해 보세요.
              </p>
              <Link
                className="mt-5 inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-md bg-student-accent px-[18px] py-[13px] text-[15px] font-semibold text-paper-surface shadow-[0_1px_0_rgba(120,60,30,.15),0_2px_6px_rgba(180,90,50,.18)] hover:bg-student-accent/90"
                href="/student"
              >
                내 책장으로 가기
              </Link>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
