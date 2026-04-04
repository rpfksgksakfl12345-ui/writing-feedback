"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "../../../components/auth-provider";
import { API_BASE_URL, apiFetch } from "../../../lib/api";

type SubmissionItem = {
  id: number;
  imageUrl: string;
  status: "PENDING" | "REVIEWED";
  createdAt: string;
  student: { name: string; grade: number | null };
  topic: { title: string; grade: number };
};

export default function TeacherSubmissionsPage() {
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
        setError(loadError instanceof Error ? loadError.message : "제출물을 불러오지 못했습니다.");
      });
  }, [token]);

  if (isReady && user?.role !== "TEACHER") {
    return <p className="rounded-xl bg-white p-6 shadow-sm">교사 계정만 접근할 수 있습니다.</p>;
  }

  return (
    <section className="rounded-xl bg-white p-6 shadow-sm">
      <h1 className="text-xl font-semibold">제출물 목록</h1>
      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      <div className="mt-4 space-y-4">
        {submissions.map((submission) => (
          <div key={submission.id} className="grid gap-4 rounded-lg border border-slate-200 p-4 md:grid-cols-[120px_1fr_auto]">
            <img
              src={`${API_BASE_URL}${submission.imageUrl}`}
              alt="제출 이미지"
              className="h-28 w-full rounded-md object-cover"
            />
            <div>
              <p className="font-medium">{submission.topic.title}</p>
              <p className="text-sm text-slate-600">
                {submission.student.name} / {submission.student.grade ?? "-"}학년
              </p>
              <p className="mt-1 text-sm text-slate-500">{submission.status}</p>
            </div>
            <div className="flex items-center">
              <Link href={`/teacher/submissions/${submission.id}`}>상세 보기</Link>
            </div>
          </div>
        ))}
        {submissions.length === 0 ? <p className="text-sm text-slate-500">제출물이 없습니다.</p> : null}
      </div>
    </section>
  );
}
