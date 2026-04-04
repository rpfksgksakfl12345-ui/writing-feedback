"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "../../../../components/auth-provider";
import { API_BASE_URL, apiFetch } from "../../../../lib/api";

type SubmissionDetail = {
  id: number;
  imageUrl: string;
  finalFeedback: string | null;
  status: "PENDING" | "REVIEWED";
  student: { name: string; grade: number | null };
  topic: { title: string; description: string | null; grade: number };
};

export default function SubmissionDetailPage() {
  const params = useParams<{ id: string }>();
  const { token, user, isReady } = useAuth();
  const [submission, setSubmission] = useState<SubmissionDetail | null>(null);
  const [finalFeedback, setFinalFeedback] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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
    setMessage("");
    setError("");

    try {
      const data = await apiFetch<SubmissionDetail>(`/api/submissions/${params.id}/feedback`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ finalFeedback }),
      });
      setSubmission((current) => (current ? { ...current, ...data } : data));
      setMessage("피드백이 저장되었습니다.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "피드백 저장에 실패했습니다.");
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
      <section className="rounded-xl bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">{submission.topic.title}</h1>
        <p className="mt-2 text-sm text-slate-600">{submission.topic.description || "설명 없음"}</p>
        <p className="mt-2 text-sm text-slate-500">
          {submission.student.name} / {submission.student.grade ?? "-"}학년 / {submission.status}
        </p>
        <img
          src={`${API_BASE_URL}${submission.imageUrl}`}
          alt="제출 이미지"
          className="mt-4 max-h-[420px] w-full rounded-lg object-contain"
        />
      </section>

      <section className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">교사 피드백</h2>
        <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
          <textarea
            rows={8}
            value={finalFeedback}
            onChange={(event) => setFinalFeedback(event.target.value)}
            placeholder="피드백을 입력하세요."
          />
          {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button type="submit">피드백 저장</button>
        </form>
      </section>
    </div>
  );
}
