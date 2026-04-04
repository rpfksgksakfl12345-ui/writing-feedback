"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { NoticeBanner } from "../../../components/notice-banner";
import { useAuth } from "../../../components/auth-provider";
import { apiFetch } from "../../../lib/api";

type Topic = {
  id: number;
  title: string;
  grade: number;
};

export default function StudentUploadPage() {
  const { token, user, isReady } = useAuth();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [topicId, setTopicId] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      return;
    }

    const gradeQuery = user?.grade ? `?grade=${user.grade}` : "";
    apiFetch<Topic[]>(`/api/topics${gradeQuery}`, { token })
      .then((data) => {
        setTopics(data);
        if (data[0]) {
          setTopicId(String(data[0].id));
        }
      })
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : "주제를 불러오지 못했습니다.");
      });
  }, [token, user?.grade]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!image || !topicId) {
      setError("주제와 이미지를 모두 선택해 주세요.");
      return;
    }

    const formData = new FormData();
    formData.append("topicId", topicId);
    formData.append("image", image);

    try {
      await apiFetch("/api/submissions", {
        method: "POST",
        token,
        body: formData,
      });
      setImage(null);
      setMessage("업로드가 완료되었습니다.");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "업로드에 실패했습니다. 파일 형식과 연결 상태를 다시 확인해 주세요.",
      );
    }
  }

  if (isReady && user?.role !== "STUDENT") {
    return <p className="rounded-xl bg-white p-6 shadow-sm">학생 계정만 접근할 수 있습니다.</p>;
  }

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">글쓰기 업로드</h1>
          <p className="mt-1 text-sm text-slate-600">
            주제를 고른 뒤 글쓰기 사진 한 장을 올리면 제출이 완료됩니다.
          </p>
        </div>
        <Link className="text-sm font-medium text-slate-600 hover:text-slate-900" href="/student/history">
          내 기록 보기
        </Link>
      </div>

      <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
        <select value={topicId} onChange={(event) => setTopicId(event.target.value)}>
          {topics.map((topic) => (
            <option key={topic.id} value={topic.id}>
              {topic.title} ({topic.grade}학년)
            </option>
          ))}
        </select>
        <input
          type="file"
          accept="image/*"
          onChange={(event) => setImage(event.target.files?.[0] || null)}
        />

        {message ? (
          <NoticeBanner
            tone="success"
            title="업로드 완료"
            description="글쓰기 사진이 저장되었습니다. 기록 화면에서 피드백 상태를 확인할 수 있습니다."
          />
        ) : null}
        {error ? <NoticeBanner tone="error" title="업로드 실패" description={error} /> : null}

        <div className="flex flex-wrap gap-3">
          <button type="submit">업로드하기</button>
          <Link
            className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
            href="/student/history"
          >
            기록 화면으로 이동
          </Link>
        </div>
      </form>
    </section>
  );
}
