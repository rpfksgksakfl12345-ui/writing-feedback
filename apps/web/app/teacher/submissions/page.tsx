"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { NoticeBanner } from "../../../components/notice-banner";
import { StatusPill } from "../../../components/status-pill";
import { useAuth } from "../../../components/auth-provider";
import { API_BASE_URL, apiFetch } from "../../../lib/api";

type SubmissionItem = {
  id: number;
  inputType: "TYPED" | "PHOTO";
  imageUrl: string | null;
  status: "PENDING" | "REVIEWED";
  createdAt: string;
  student: { name: string; grade: number | null };
  topic: { title: string; grade: number };
};

function getInputTypeBadge(inputType: SubmissionItem["inputType"]) {
  return inputType === "TYPED" ? "✏️" : "📷";
}

export default function TeacherSubmissionsPage() {
  const searchParams = useSearchParams();
  const { token, user, isReady } = useAuth();
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  const [error, setError] = useState("");
  const saved = searchParams.get("saved") === "1";

  useEffect(() => {
    if (!token) {
      return;
    }

    apiFetch<SubmissionItem[]>("/api/submissions", { token })
      .then(setSubmissions)
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : "제출물을 불러오지 못했습니다.");
      });
  }, [token]);

  if (isReady && user?.role !== "TEACHER") {
    return <p className="rounded-xl bg-white p-6 shadow-sm">교사 계정만 접근할 수 있습니다.</p>;
  }

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">제출물 목록</h1>
          <p className="mt-1 text-sm text-slate-600">
            글로 쓴 제출과 사진 제출을 함께 확인하고 피드백을 저장할 수 있습니다.
          </p>
        </div>
        <Link className="text-sm font-medium text-slate-600 hover:text-slate-900" href="/teacher/topics">
          주제 관리로 이동
        </Link>
      </div>

      {saved ? (
        <div className="mt-4">
          <NoticeBanner
            tone="success"
            title="피드백 저장 완료"
            description="저장 후 다시 제출물 목록으로 돌아왔습니다."
          />
        </div>
      ) : null}

      {error ? (
        <div className="mt-4">
          <NoticeBanner tone="error" title="제출물 불러오기 실패" description={error} />
        </div>
      ) : null}

      <div className="mt-4 space-y-4">
        {submissions.map((submission) => (
          <div
            key={submission.id}
            className="grid gap-4 rounded-2xl border border-slate-200 p-4 md:grid-cols-[120px_1fr_auto]"
          >
            <div className="flex h-28 items-center justify-center rounded-xl bg-slate-100">
              {submission.inputType === "PHOTO" && submission.imageUrl ? (
                <img
                  src={`${API_BASE_URL}${submission.imageUrl}`}
                  alt="제출 이미지"
                  className="h-28 w-full rounded-xl object-cover"
                />
              ) : (
                <span className="text-3xl">{getInputTypeBadge(submission.inputType)}</span>
              )}
            </div>
            <div>
              <p className="font-medium">
                {getInputTypeBadge(submission.inputType)} {submission.topic.title}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {submission.student.name} / {submission.student.grade ?? "-"}학년 /{" "}
                {submission.topic.grade}학년 주제
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {submission.inputType === "TYPED" ? "글로 쓰기 제출" : "사진 제출"}
              </p>
              <div className="mt-3">
                <StatusPill status={submission.status} />
              </div>
            </div>
            <div className="flex items-center">
              <Link
                className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white"
                href={`/teacher/submissions/${submission.id}`}
              >
                피드백 작성
              </Link>
            </div>
          </div>
        ))}
        {submissions.length === 0 ? <p className="text-sm text-slate-500">제출물이 없습니다.</p> : null}
      </div>
    </section>
  );
}
