"use client";

import { FormEvent, useEffect, useState } from "react";
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
      setError("주제와 이미지를 모두 선택하세요.");
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
      setMessage("제출이 완료되었습니다.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "제출에 실패했습니다.");
    }
  }

  if (isReady && user?.role !== "STUDENT") {
    return <p className="rounded-xl bg-white p-6 shadow-sm">학생 계정만 접근할 수 있습니다.</p>;
  }

  return (
    <section className="rounded-xl bg-white p-6 shadow-sm">
      <h1 className="text-xl font-semibold">글쓰기 업로드</h1>
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
        {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button type="submit">업로드</button>
      </form>
    </section>
  );
}
