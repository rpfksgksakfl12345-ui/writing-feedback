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

type TopicSuggestionResult = {
  topics: string[];
};

export default function TeacherTopicsPage() {
  const { token, user, isReady } = useAuth();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [grade, setGrade] = useState("3");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [aiError, setAiError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [suggestedTopics, setSuggestedTopics] = useState<string[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState("");

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
      setSuggestedTopics([]);
      setSelectedSuggestion("");
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

  async function handleGenerateTopics() {
    if (!token || isGenerating) {
      return;
    }

    setAiError("");
    setMessage("");
    setIsGenerating(true);

    try {
      const response = await apiFetch<TopicSuggestionResult>("/api/topics/generate", {
        method: "POST",
        token,
        body: JSON.stringify({ grade: Number(grade) }),
      });

      setSuggestedTopics(response.topics);
      setSelectedSuggestion(response.topics[0] ?? "");
    } catch (generateError) {
      setSuggestedTopics([]);
      setSelectedSuggestion("");
      setAiError(
        generateError instanceof Error
          ? generateError.message
          : "AI 주제 추천에 실패했습니다. 잠시 후 다시 시도해 주세요.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  function applySuggestedTopic() {
    if (!selectedSuggestion) {
      setAiError("추천된 주제 중 하나를 먼저 선택해 주세요.");
      return;
    }

    setTitle(selectedSuggestion);
    setDescription(`${grade}학년 학생이 300자 이내로 쓰기 좋은 글쓰기 주제입니다.`);
    setAiError("");
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
            학생이 바로 선택할 수 있도록 학년과 주제를 등록합니다.
          </p>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700" htmlFor="ai-grade">
                추천 받을 학년
              </label>
              <select id="ai-grade" value={grade} onChange={(event) => setGrade(event.target.value)}>
                {[1, 2, 3, 4, 5, 6].map((value) => (
                  <option key={value} value={value}>
                    {value}학년
                  </option>
                ))}
              </select>
            </div>
            <button disabled={isGenerating} onClick={handleGenerateTopics} type="button">
              {isGenerating ? "추천 생성 중..." : "AI로 주제 5개 추천"}
            </button>
          </div>

          <p className="mt-3 text-sm text-slate-600">
            버튼을 누를 때에만 AI를 호출하며, 추천 결과는 자동 저장되지 않습니다.
          </p>

          {aiError ? (
            <div className="mt-4">
              <NoticeBanner tone="error" title="AI 추천 실패" description={aiError} />
            </div>
          ) : null}

          {suggestedTopics.length > 0 ? (
            <div className="mt-4 space-y-3">
              <p className="text-sm font-medium text-slate-700">
                추천 결과에서 하나를 고른 뒤 기존 주제 입력칸으로 넣을 수 있습니다.
              </p>

              {suggestedTopics.map((suggestion) => (
                <label
                  key={suggestion}
                  className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3"
                >
                  <input
                    checked={selectedSuggestion === suggestion}
                    name="topicSuggestion"
                    onChange={() => setSelectedSuggestion(suggestion)}
                    type="radio"
                    value={suggestion}
                  />
                  <span className="text-sm text-slate-700">{suggestion}</span>
                </label>
              ))}

              <button onClick={applySuggestedTopic} type="button">
                선택한 주제로 입력
              </button>
            </div>
          ) : null}
        </div>

        <form className="mt-4 space-y-4" onSubmit={handleCreateTopic}>
          <input
            placeholder="예: 우리 가족과 함께한 주말 이야기"
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

          {message ? <NoticeBanner tone="success" title="주제 등록 완료" description={message} /> : null}
          {error ? <NoticeBanner tone="error" title="주제 등록 실패" description={error} /> : null}

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
