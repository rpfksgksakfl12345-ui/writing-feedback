"use client";

import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "../../../components/auth-provider";
import { apiFetch } from "../../../lib/api";

type Topic = {
  id: number;
  title: string;
  description: string | null;
  grade: number;
  createdAt: string;
};

export default function TeacherTopicsPage() {
  const { token, user, isReady } = useAuth();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [grade, setGrade] = useState("3");
  const [error, setError] = useState("");

  async function loadTopics() {
    if (!token) {
      return;
    }

    try {
      const data = await apiFetch<Topic[]>("/api/topics", { token });
      setTopics(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "주제를 불러오지 못했습니다.");
    }
  }

  useEffect(() => {
    void loadTopics();
  }, [token]);

  async function handleCreateTopic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    try {
      await apiFetch("/api/topics", {
        method: "POST",
        token,
        body: JSON.stringify({ title, description, grade: Number(grade) }),
      });
      setTitle("");
      setDescription("");
      setGrade("3");
      await loadTopics();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "주제 생성에 실패했습니다.");
    }
  }

  if (isReady && user?.role !== "TEACHER") {
    return <p className="rounded-xl bg-white p-6 shadow-sm">교사 계정만 접근할 수 있습니다.</p>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">주제 생성</h1>
        <form className="mt-4 space-y-4" onSubmit={handleCreateTopic}>
          <input
            placeholder="주제 제목"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <textarea
            placeholder="설명"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
          />
          <select value={grade} onChange={(event) => setGrade(event.target.value)}>
            {[1, 2, 3, 4, 5, 6].map((value) => (
              <option key={value} value={value}>
                {value}학년
              </option>
            ))}
          </select>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button type="submit">주제 추가</button>
        </form>
      </section>

      <section className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">주제 목록</h2>
        <div className="mt-4 space-y-3">
          {topics.map((topic) => (
            <div key={topic.id} className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">{topic.title}</h3>
                <span className="text-sm text-slate-500">{topic.grade}학년</span>
              </div>
              <p className="mt-2 text-sm text-slate-600">{topic.description || "설명 없음"}</p>
            </div>
          ))}
          {topics.length === 0 ? <p className="text-sm text-slate-500">등록된 주제가 없습니다.</p> : null}
        </div>
      </section>
    </div>
  );
}
