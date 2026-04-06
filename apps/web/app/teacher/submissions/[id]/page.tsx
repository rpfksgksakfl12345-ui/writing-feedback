"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { NoticeBanner } from "../../../../components/notice-banner";
import { StatusPill } from "../../../../components/status-pill";
import { useAuth } from "../../../../components/auth-provider";
import { API_BASE_URL, apiFetch } from "../../../../lib/api";

type SubmissionDetail = {
  id: number;
  inputType: "TYPED" | "PHOTO";
  imageUrl: string | null;
  content: string | null;
  finalFeedback: string | null;
  status: "PENDING" | "REVIEWED";
  ocrStatus: "NONE" | "PROCESSING" | "DONE" | "FAILED";
  ocrError: string | null;
  student: { name: string; grade: number | null };
  topic: { title: string; description: string | null; grade: number };
};

export default function SubmissionDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { token, user, isReady } = useAuth();
  const [submission, setSubmission] = useState<SubmissionDetail | null>(null);
  const [finalFeedback, setFinalFeedback] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function loadSubmission() {
    if (!token) {
      return;
    }

    try {
      const data = await apiFetch<SubmissionDetail>(`/api/submissions/${params.id}`, { token });
      setSubmission(data);
      setFinalFeedback(data.finalFeedback || "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "상세 정보를 불러오지 못했습니다.");
    }
  }

  useEffect(() => {
    void loadSubmission();
  }, [params.id, token]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSaving(true);

    try {
      await apiFetch<SubmissionDetail>(`/api/submissions/${params.id}/feedback`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ finalFeedback }),
      });
      router.push("/teacher/submissions?saved=1");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "피드백을 저장하지 못했습니다. 내용을 다시 확인해 주세요.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (isReady && user?.role !== "TEACHER") {
    return <p className="rounded-xl bg-white p-6 shadow-sm">교사 계정만 접근할 수 있습니다.</p>;
  }

  if (!submission) {
    return <p className="rounded-xl bg-white p-6 shadow-sm">불러오는 중...</p>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link className="text-sm font-medium text-slate-500 hover:text-slate-900" href="/teacher/submissions">
              제출물 목록으로 돌아가기
            </Link>
            <h1 className="mt-2 text-xl font-semibold">{submission.topic.title}</h1>
          </div>
          <StatusPill status={submission.status} />
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-600">{submission.topic.description || "설명 없음"}</p>
        <p className="mt-2 text-sm text-slate-500">
          {submission.student.name} / {submission.student.grade ?? "-"}학년 /{" "}
          {submission.inputType === "TYPED" ? "글로 쓰기" : "사진 제출"}
        </p>

        {submission.inputType === "TYPED" ? (
          <div className="mt-4 rounded-2xl bg-slate-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">제출 내용</p>
            <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-700">
              {submission.content}
            </p>
          </div>
        ) : (
          <img
            src={`${API_BASE_URL}${submission.imageUrl}`}
            alt="제출 이미지"
            className="mt-4 max-h-[420px] w-full rounded-2xl border border-slate-200 object-contain"
          />
        )}

        {submission.inputType === "PHOTO" && submission.ocrStatus !== "NONE" ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold">OCR 상태</p>
            <p className="mt-1 text-sm text-slate-600">{submission.ocrStatus}</p>
            {submission.ocrError ? <p className="mt-2 text-sm text-red-600">{submission.ocrError}</p> : null}
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">교사 피드백</h2>
        <p className="mt-2 text-sm text-slate-600">
          저장하면 제출물 목록으로 돌아가 다음 학생 작업을 바로 이어갈 수 있습니다.
        </p>
        <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
          <textarea
            rows={8}
            value={finalFeedback}
            onChange={(event) => setFinalFeedback(event.target.value)}
            placeholder="학생에게 보여 줄 최종 피드백을 입력하세요."
          />
          {error ? <NoticeBanner tone="error" title="피드백 저장 실패" description={error} /> : null}
          <div className="flex flex-wrap gap-3">
            <button disabled={isSaving} type="submit">
              {isSaving ? "저장 중..." : "저장하고 제출 목록으로"}
            </button>
            <Link
              className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
              href="/teacher/submissions"
            >
              목록으로만 돌아가기
            </Link>
          </div>
        </form>
      </section>
    </div>
  );
}
