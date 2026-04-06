"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { NoticeBanner } from "../../../components/notice-banner";
import { StatusPill } from "../../../components/status-pill";
import { useAuth } from "../../../components/auth-provider";
import { API_BASE_URL, apiFetch } from "../../../lib/api";

type SubmissionItem = {
  id: number;
  inputType: "TYPED" | "PHOTO";
  imageUrl: string | null;
  content: string | null;
  status: "PENDING" | "REVIEWED";
  finalFeedback: string | null;
  topic: { title: string };
};

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
    return <p className="rounded-xl bg-white p-6 shadow-sm">학생 계정만 접근할 수 있습니다.</p>;
  }

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">제출 기록</h1>
          <p className="mt-1 text-sm text-slate-600">
            글로 쓰기와 사진 제출을 함께 확인할 수 있습니다.
          </p>
        </div>
        <Link className="text-sm font-medium text-slate-600 hover:text-slate-900" href="/student/upload">
          새로 제출하기
        </Link>
      </div>

      {error ? (
        <div className="mt-4">
          <NoticeBanner tone="error" title="기록 불러오기 실패" description={error} />
        </div>
      ) : null}

      <div className="mt-4 space-y-4">
        {submissions.map((submission) => (
          <div
            key={submission.id}
            className="grid gap-4 rounded-2xl border border-slate-200 p-4 md:grid-cols-[160px_1fr]"
          >
            <div className="flex h-36 items-center justify-center rounded-2xl bg-slate-100">
              {submission.inputType === "PHOTO" && submission.imageUrl ? (
                <img
                  src={`${API_BASE_URL}${submission.imageUrl}`}
                  alt="제출 이미지"
                  className="h-36 w-full rounded-2xl object-cover"
                />
              ) : (
                <div className="px-4 text-center">
                  <p className="text-3xl">✏️</p>
                  <p className="mt-2 text-sm font-medium text-slate-600">글로 쓴 제출</p>
                </div>
              )}
            </div>
            <div className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{submission.topic.title}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {submission.inputType === "TYPED" ? "글로 쓰기" : "사진 제출"}
                  </p>
                </div>
                <StatusPill status={submission.status} />
              </div>
              {submission.inputType === "TYPED" ? (
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    제출 내용
                  </p>
                  <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">
                    {submission.content}
                  </p>
                </div>
              ) : null}
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  교사 피드백
                </p>
                <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">
                  {submission.finalFeedback || "아직 교사 피드백이 등록되지 않았습니다."}
                </p>
              </div>
            </div>
          </div>
        ))}
        {submissions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-10 text-center">
            <p className="text-sm text-slate-500">
              제출 기록이 없습니다. 먼저 글로 쓰기 또는 사진 제출을 진행해 보세요.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
