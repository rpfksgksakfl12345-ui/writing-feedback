"use client";

import { FormEvent, useEffect, useState } from "react";
import { NoticeBanner } from "../../../components/notice-banner";
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
  const [message, setMessage] = useState("");
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
    setMessage("");
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
      setMessage("주제가 등록되었습니다. 학생은 이제 해당 학년에서 이 주제를 선택할 수 있습니다.");
      await loadTopics();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "주제를 저장하지 못했습니다. 제목과 학년을 다시 확인해 주세요.",
      );
    }
  }

  if (isReady && user?.role !== "TEACHER") {
    return <p className="rounded-xl bg-white p-6 shadow-sm">교사 계정만 접근할 수 있습니다.</p>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div>
          <h1 className="text-xl font-semibold">주제 생성</h1>
          <p className="mt-1 text-sm text-slate-600">
            학생이 바로 선택할 수 있도록 학년과 주제를 간단히 등록합니다.
          </p>
        </div>
        <form className="mt-4 space-y-4" onSubmit={handleCreateTopic}>
          <input
            placeholder="예: 우리 반을 소개하는 글"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <textarea
            placeholder="학생에게 보여 줄 간단한 안내를 적어 주세요."
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
          {message ? <NoticeBanner tone="success" title="주제 저장 완료" description={message} /> : null}
          {error ? <NoticeBanner tone="error" title="주제 저장 실패" description={error} /> : null}
          <button type="submit">주제 저장</button>
        </form>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">주제 목록</h2>
        <div className="mt-4 space-y-3">
          {topics.map((topic) => (
            <div key={topic.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-medium">{topic.title}</h3>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
                  {topic.grade}학년
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">{topic.description || "설명 없음"}</p>
            </div>
          ))}
          {topics.length === 0 ? <p className="text-sm text-slate-500">등록된 주제가 없습니다.</p> : null}
        </div>
      </section>
    </div>
  );
}
