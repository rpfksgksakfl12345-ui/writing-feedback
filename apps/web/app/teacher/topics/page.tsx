"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { NoticeBanner } from "../../../components/notice-banner";
import { useAuth } from "../../../components/auth-provider";
import { Badge, PrimaryButton, SecondaryButton } from "../../../components/ui-v2";
import { apiFetch } from "../../../lib/api";

type Topic = {
  id: number;
  title: string;
  description: string | null;
  grade: number;
  createdAt: string;
  classroomId?: number | null;
};

type Classroom = {
  id: number;
  name: string;
  grade: number;
  classCode: string;
};

type TopicSuggestionResult = {
  topics: string[];
};

function formatTopicDate(createdAt: string) {
  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    return "생성일 정보 없음";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
  }).format(date);
}

export default function TeacherTopicsPage() {
  const { token, user, isReady } = useAuth();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [grade, setGrade] = useState("3");
  const [classroomId, setClassroomId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [aiError, setAiError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingTopics, setIsLoadingTopics] = useState(true);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [suggestedTopics, setSuggestedTopics] = useState<string[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState("");

  async function loadTopics() {
    if (!token) {
      return;
    }

    setIsLoadingTopics(true);

    try {
      const [nextTopics, nextClassrooms] = await Promise.all([
        apiFetch<Topic[]>("/api/topics", { token }),
        apiFetch<Classroom[]>("/api/classrooms", { token }),
      ]);

      setTopics(nextTopics);
      setClassrooms(nextClassrooms);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "주제를 불러오지 못했습니다.");
    } finally {
      setIsLoadingTopics(false);
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
      const body: {
        title: string;
        description: string;
        grade: number;
        classroomId?: number;
      } = {
        title,
        description,
        grade: Number(grade),
      };

      if (classroomId) {
        body.classroomId = Number(classroomId);
      }

      await apiFetch("/api/topics", {
        method: "POST",
        token,
        body: JSON.stringify(body),
      });

      setTitle("");
      setDescription("");
      setGrade("3");
      setClassroomId("");
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
    return (
      <section className="rounded-xl border border-[#E8DEC7] bg-[#FFFAF0] p-6 text-[#5A5247] shadow-sm">
        교사 계정만 접근할 수 있습니다.
      </section>
    );
  }

  const gradeOptions = [1, 2, 3, 4, 5, 6];
  const currentGradeTopicCount = topics.filter((topic) => String(topic.grade) === grade).length;

  return (
    <div className="overflow-hidden rounded-[28px] border border-[#E8DEC7] bg-paper-base shadow-sm">
      <section className="bg-[radial-gradient(rgba(90,110,133,.05)_1px,transparent_1px)] bg-[length:24px_24px] px-8 pb-7 pt-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-sm font-semibold text-teacher-accent">Teacher Topics</p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-[#2E2A24]">
              글쓰기 주제 관리
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#5A5247]">
              학년별 글쓰기 주제를 만들고, 학생 책장에 꽂힐 주제를 준비합니다.
            </p>
          </div>

          <div className="grid min-w-[260px] grid-cols-2 gap-3 rounded-xl border border-[#E8DEC7] bg-[#FFFAF0]/85 p-4 shadow-sm">
            <div>
              <p className="text-xs text-[#8B8170]">전체 주제</p>
              <p className="mt-1 text-lg font-semibold text-[#2E2A24]">{topics.length}</p>
            </div>
            <div>
              <p className="text-xs text-[#8B8170]">선택 학년</p>
              <p className="mt-1 text-lg font-semibold text-teacher-accent">
                {grade}학년 · {currentGradeTopicCount}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 px-8 pb-10 pt-7 xl:grid-cols-[minmax(360px,.9fr)_minmax(0,1.1fr)]">
        <div className="space-y-5">
          <section className="rounded-xl border border-[#E8DEC7] bg-[#FFFAF0] p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B8170]">
                  AI 추천
                </p>
                <h2 className="mt-1 text-xl font-bold text-[#2E2A24]">오늘의 글쓰기 주제 찾기</h2>
                <p className="mt-2 text-sm leading-6 text-[#5A5247]">
                  버튼을 누를 때에만 AI를 호출하며, 선택한 학년에 맞는 주제 10개를 추천합니다.
                </p>
              </div>
              <Badge tone="teacher">{grade}학년</Badge>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[160px_1fr] lg:items-end">
              <label className="block text-sm font-semibold text-[#5A5247]" htmlFor="ai-grade">
                추천 받을 학년
                <select
                  className="mt-2 h-11 rounded-md border-[#E8DEC7] bg-[#FFFAF0] text-sm text-[#2E2A24] focus:border-teacher-accent focus:ring-teacher-accent/20"
                  id="ai-grade"
                  value={grade}
                  onChange={(event) => setGrade(event.target.value)}
                >
                  {gradeOptions.map((value) => (
                    <option key={value} value={value}>
                      {value}학년
                    </option>
                  ))}
                </select>
              </label>

              <PrimaryButton
                className="w-full lg:w-fit"
                disabled={isGenerating}
                onClick={handleGenerateTopics}
                tone="teacher"
                type="button"
              >
                {isGenerating ? "추천 생성 중..." : "AI로 주제 10개 추천"}
              </PrimaryButton>
            </div>

            {aiError ? (
              <div className="mt-4">
                <NoticeBanner tone="error" title="AI 추천 실패" description={aiError} />
              </div>
            ) : null}

            {suggestedTopics.length > 0 ? (
              <div className="mt-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[#5A5247]">
                    추천 결과 중 하나를 고른 뒤 입력칸으로 가져올 수 있습니다.
                  </p>
                  <SecondaryButton onClick={applySuggestedTopic} type="button">
                    선택한 주제로 입력
                  </SecondaryButton>
                </div>

                <div className="grid gap-3">
                  {suggestedTopics.map((suggestion, index) => {
                    const isSelected = selectedSuggestion === suggestion;

                    return (
                      <button
                        key={suggestion}
                        className={`rounded-lg border px-4 py-3 text-left shadow-none ${
                          isSelected
                            ? "border-teacher-accent bg-teacher-accent/10 text-[#2E2A24]"
                            : "border-[#E8DEC7] bg-paper-base/55 text-[#5A5247] hover:bg-paper-base"
                        }`}
                        onClick={() => setSelectedSuggestion(suggestion)}
                        type="button"
                      >
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 text-xs font-semibold text-teacher-accent">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <span className="text-sm font-semibold leading-6">{suggestion}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-lg border border-dashed border-[#C9B998] bg-paper-base/60 px-5 py-6 text-sm text-[#8B8170]">
                아직 추천 결과가 없습니다. 학년을 고른 뒤 AI 추천을 생성해 보세요.
              </div>
            )}
          </section>

          <section className="rounded-xl border border-[#E8DEC7] bg-[#FFFAF0] p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B8170]">
              새 주제 등록
            </p>
            <h2 className="mt-1 text-xl font-bold text-[#2E2A24]">학생 책장에 펼칠 주제</h2>

            <form className="mt-5 space-y-4" onSubmit={handleCreateTopic}>
              <label className="block text-sm font-semibold text-[#5A5247]">
                주제 제목
                <input
                  className="mt-2 h-11 rounded-md border-[#E8DEC7] bg-[#FFFAF0] text-sm text-[#2E2A24] placeholder:text-[#A89C85] focus:border-teacher-accent focus:ring-teacher-accent/20"
                  placeholder="예: 우리 가족과 함께한 주말 이야기"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </label>

              <label className="block text-sm font-semibold text-[#5A5247]">
                학생에게 보여 줄 안내
                <textarea
                  className="mt-2 min-h-[132px] rounded-md border-[#E8DEC7] bg-[#FFFAF0] text-sm leading-7 text-[#2E2A24] placeholder:text-[#A89C85] focus:border-teacher-accent focus:ring-teacher-accent/20"
                  placeholder="학생에게 보여 줄 간단한 안내를 적어 주세요."
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={4}
                />
              </label>

              <label className="block text-sm font-semibold text-[#5A5247]">
                학급 연결
                <select
                  className="mt-2 h-11 rounded-md border-[#E8DEC7] bg-[#FFFAF0] text-sm text-[#2E2A24] focus:border-teacher-accent focus:ring-teacher-accent/20"
                  value={classroomId}
                  onChange={(event) => setClassroomId(event.target.value)}
                >
                  <option value="">전체 학생에게 공개</option>
                  {classrooms.map((classroom) => (
                    <option key={classroom.id} value={classroom.id}>
                      {classroom.name} · {classroom.grade}학년 · {classroom.classCode}
                    </option>
                  ))}
                </select>
                {classrooms.length === 0 ? (
                  <span className="mt-2 block text-xs leading-5 text-[#8B8170]">
                    아직 학급이 없습니다.{" "}
                    <Link className="font-semibold text-teacher-accent hover:underline" href="/teacher/classrooms">
                      학급을 먼저 만들 수 있습니다.
                    </Link>
                  </span>
                ) : (
                  <span className="mt-2 block text-xs leading-5 text-[#8B8170]">
                    선택하지 않으면 기존처럼 전체 학생용 주제로 저장됩니다.
                  </span>
                )}
              </label>

              <label className="block text-sm font-semibold text-[#5A5247]">
                학년
                <select
                  className="mt-2 h-11 rounded-md border-[#E8DEC7] bg-[#FFFAF0] text-sm text-[#2E2A24] focus:border-teacher-accent focus:ring-teacher-accent/20"
                  value={grade}
                  onChange={(event) => setGrade(event.target.value)}
                >
                  {gradeOptions.map((value) => (
                    <option key={value} value={value}>
                      {value}학년
                    </option>
                  ))}
                </select>
              </label>

              {message ? <NoticeBanner tone="success" title="주제 등록 완료" description={message} /> : null}
              {error ? <NoticeBanner tone="error" title="주제 등록 실패" description={error} /> : null}

              <div className="flex justify-end">
                <PrimaryButton tone="teacher" type="submit">
                  주제 저장
                </PrimaryButton>
              </div>
            </form>
          </section>
        </div>

        <section className="rounded-xl border border-[#E8DEC7] bg-[#FFFAF0] p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B8170]">
                Topic Library
              </p>
              <h2 className="mt-1 text-xl font-bold text-[#2E2A24]">주제 목록</h2>
              <p className="mt-2 text-sm leading-6 text-[#5A5247]">
                학생 책장에 보일 글쓰기 주제입니다.
              </p>
            </div>
            <Badge tone="teacher">{topics.length}개</Badge>
          </div>

          <div className="mt-5 space-y-3">
            {isLoadingTopics ? (
              <div className="rounded-xl border border-dashed border-[#C9B998] bg-paper-base/60 px-6 py-12 text-center text-sm text-[#8B8170]">
                주제 목록을 불러오는 중입니다...
              </div>
            ) : null}

            {!isLoadingTopics && topics.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#C9B998] bg-paper-base/60 px-6 py-12 text-center">
                <p className="text-lg font-semibold text-[#2E2A24]">등록된 주제가 없습니다.</p>
                <p className="mt-2 text-sm text-[#5A5247]">
                  첫 주제를 만들면 학생 책장에서 바로 선택할 수 있습니다.
                </p>
              </div>
            ) : null}

            {!isLoadingTopics
              ? topics.map((topic) => (
                  <article
                    key={topic.id}
                    className="rounded-xl border border-[#E8DEC7] bg-paper-base/45 p-4 transition hover:bg-paper-base/70"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone="teacher">{topic.grade}학년</Badge>
                          <span className="text-xs font-semibold text-[#8B8170]">
                            {formatTopicDate(topic.createdAt)}
                          </span>
                        </div>
                        <h3 className="mt-3 text-lg font-bold leading-tight text-[#2E2A24]">
                          {topic.title}
                        </h3>
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[#5A5247]">
                      {topic.description || "설명 없음"}
                    </p>
                  </article>
                ))
              : null}
          </div>
        </section>
      </section>
    </div>
  );
}
