"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../../components/auth-provider";
import { API_BASE_URL, apiFetch } from "../../../lib/api";

type SubmissionItem = {
  id: number;
  imageUrl: string;
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
    <section className="rounded-xl bg-white p-6 shadow-sm">
      <h1 className="text-xl font-semibold">제출 기록</h1>
      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      <div className="mt-4 space-y-4">
        {submissions.map((submission) => (
          <div key={submission.id} className="grid gap-4 rounded-lg border border-slate-200 p-4 md:grid-cols-[120px_1fr]">
            <img
              src={`${API_BASE_URL}${submission.imageUrl}`}
              alt="제출 이미지"
              className="h-28 w-full rounded-md object-cover"
            />
            <div>
              <p className="font-medium">{submission.topic.title}</p>
              <p className="mt-1 text-sm text-slate-500">{submission.status}</p>
              <p className="mt-3 text-sm text-slate-700">
                {submission.finalFeedback || "아직 교사 피드백이 없습니다."}
              </p>
            </div>
          </div>
        ))}
        {submissions.length === 0 ? <p className="text-sm text-slate-500">제출 기록이 없습니다.</p> : null}
      </div>
    </section>
  );
}
