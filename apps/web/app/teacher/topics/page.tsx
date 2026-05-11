"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { NoticeBanner } from "../../../components/notice-banner";
import { useAuth } from "../../../components/auth-provider";
import { Badge, PrimaryButton } from "../../../components/ui-v2";
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

type TopicSuggestion = {
  title: string;
  studentGuide: string;
};

type TopicSuggestionResult = {
  topics: Array<string | Partial<TopicSuggestion>>;
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

function getDefaultGradeFromClassrooms(classrooms: Classroom[]) {
  return classrooms[0]?.grade ? String(classrooms[0].grade) : "3";
}

function normalizeTopicSuggestion(value: string | Partial<TopicSuggestion>): TopicSuggestion | null {
  if (typeof value === "string") {
    const title = value.trim();
    return title ? { title, studentGuide: "" } : null;
  }

  const title = typeof value.title === "string" ? value.title.trim() : "";
  const studentGuide =
    typeof value.studentGuide === "string" ? value.studentGuide.trim() : "";

  if (!title) {
    return null;
  }

  return { title, studentGuide };
}

function normalizeTopicSuggestions(values: Array<string | Partial<TopicSuggestion>>) {
  return values
    .map(normalizeTopicSuggestion)
    .filter((suggestion): suggestion is TopicSuggestion => Boolean(suggestion));
}

const recommendationTiltClasses = [
  "-rotate-[0.8deg]",
  "rotate-[0.5deg]",
  "-rotate-[0.3deg]",
  "rotate-[0.7deg]",
];

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
  const [isLoadingClassrooms, setIsLoadingClassrooms] = useState(true);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [suggestedTopics, setSuggestedTopics] = useState<TopicSuggestion[]>([]);
  const [selectedSuggestionTitle, setSelectedSuggestionTitle] = useState("");

  async function loadClassrooms() {
    if (!token) {
      return;
    }

    setIsLoadingClassrooms(true);
    setError("");

    try {
      const nextClassrooms = await apiFetch<Classroom[]>("/api/classrooms", { token });
      const nextSelectedClassroom = nextClassrooms.find(
        (classroom) => String(classroom.id) === classroomId,
      ) ?? nextClassrooms[0] ?? null;

      setClassrooms(nextClassrooms);
      setClassroomId(nextSelectedClassroom ? String(nextSelectedClassroom.id) : "");
      setGrade(nextSelectedClassroom ? String(nextSelectedClassroom.grade) : "3");

      if (nextClassrooms.length === 0) {
        setTopics([]);
        setIsLoadingTopics(false);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "학급 목록을 불러오지 못했습니다.");
    } finally {
      setIsLoadingClassrooms(false);
    }
  }

  async function loadTopicsForClassroom(nextClassroomId = classroomId) {
    if (!token) {
      return;
    }

    if (!nextClassroomId) {
      setTopics([]);
      setIsLoadingTopics(false);
      return;
    }

    setIsLoadingTopics(true);

    try {
      const nextTopics = await apiFetch<Topic[]>(`/api/topics?classroomId=${nextClassroomId}`, {
        token,
      });

      setTopics(nextTopics);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "주제를 불러오지 못했습니다.");
    } finally {
      setIsLoadingTopics(false);
    }
  }

  useEffect(() => {
    void loadClassrooms();
  }, [token]);

  useEffect(() => {
    void loadTopicsForClassroom();
  }, [token, classroomId]);

  async function handleCreateTopic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!classroomId) {
      setError("주제를 등록하기 전에 학급을 먼저 만들어 주세요.");
      return;
    }

    try {
      const body: {
        title: string;
        description: string;
        grade: number;
        classroomId: number;
      } = {
        title,
        description,
        grade: Number(grade),
        classroomId: Number(classroomId),
      };

      await apiFetch("/api/topics", {
        method: "POST",
        token,
        body: JSON.stringify(body),
      });

      setTitle("");
      setDescription("");
      setGrade(selectedClassroom ? String(selectedClassroom.grade) : getDefaultGradeFromClassrooms(classrooms));
      setSuggestedTopics([]);
      setSelectedSuggestionTitle("");
      setMessage("주제가 등록되었습니다. 학생은 이제 해당 학년에서 이 주제를 선택할 수 있습니다.");
      await loadTopicsForClassroom(classroomId);
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

    if (!classroomId) {
      setAiError("추천을 받기 전에 학급을 먼저 만들어 주세요.");
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

      setSuggestedTopics(normalizeTopicSuggestions(response.topics));
      setSelectedSuggestionTitle("");
    } catch (generateError) {
      setSuggestedTopics([]);
      setSelectedSuggestionTitle("");
      setAiError(
        generateError instanceof Error
          ? generateError.message
          : "AI 주제 추천에 실패했습니다. 잠시 후 다시 시도해 주세요.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  function applySuggestedTopic(suggestion: TopicSuggestion) {
    setSelectedSuggestionTitle(suggestion.title);
    setTitle(suggestion.title);
    setDescription(
      suggestion.studentGuide ||
        `${grade}학년 학생이 300자 이내로 쓰기 좋은 글쓰기 주제입니다.`,
    );
    setAiError("");
  }

  if (isReady && user?.role !== "TEACHER") {
    return (
      <section className="rounded-xl border border-ink-100 bg-paper-surface p-6 text-ink-700 shadow-sm">
        교사 계정만 접근할 수 있습니다.
      </section>
    );
  }

  const gradeOptions = [1, 2, 3, 4, 5, 6];
  const currentGradeTopicCount = topics.filter((topic) => String(topic.grade) === grade).length;
  const selectedClassroom = classroomId
    ? classrooms.find((classroom) => String(classroom.id) === classroomId)
    : null;
  const hasClassrooms = classrooms.length > 0;
  const isTopicWorkDisabled = isLoadingClassrooms || !hasClassrooms || !classroomId;
  const noClassroomHelp =
    "학급을 만든 뒤, 그 학급에 보여줄 글쓰기 주제를 만들 수 있어요.";

  return (
    <div className="overflow-hidden rounded-[28px] border border-ink-100 bg-paper-soft shadow-[0_1px_2px_rgba(60,40,20,.06),0_14px_34px_rgba(60,40,20,.08)]">
      <section className="bg-paper-surface bg-[radial-gradient(rgba(90,110,133,.07)_1px,transparent_1px)] bg-[length:24px_24px] px-8 pb-7 pt-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-sm font-semibold text-teacher-accent">교사 주제 관리</p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-ink-900">
              글쓰기 주제 관리
            </h1>
            <p className="kr-keep mt-3 max-w-2xl text-sm leading-6 text-ink-700">
              학년별 글쓰기 주제를 만들고, 학생 책장에 꽂힐 주제를 준비합니다.
            </p>
          </div>

          <div className="grid min-w-[260px] grid-cols-2 gap-3 rounded-xl border border-ink-100 bg-paper-surface/85 p-4 shadow-sm">
            <div>
              <p className="text-xs text-ink-500">전체 주제</p>
              <p className="mt-1 text-lg font-semibold text-ink-900">{topics.length}</p>
            </div>
            <div>
              <p className="text-xs text-ink-500">선택 학년</p>
              <p className="mt-1 text-lg font-semibold text-teacher-accent">
                {grade}학년 · {currentGradeTopicCount}
              </p>
            </div>
            <div className="col-span-2 rounded-lg border border-teacher-accent/20 bg-teacher-soft/60 px-3 py-2">
              <p className="text-xs text-ink-500">현재 학급</p>
              <p className="mt-1 truncate text-sm font-semibold text-teacher-deep">
                {selectedClassroom
                  ? `${selectedClassroom.name} · ${selectedClassroom.classCode}`
                  : isLoadingClassrooms
                    ? "학급 확인 중"
                    : "학급 없음"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 px-8 pb-10 pt-7 xl:grid-cols-[minmax(360px,.9fr)_minmax(0,1.1fr)]">
        <div className="space-y-5">
          <section className="rounded-xl border border-dashed border-teacher-accent/30 bg-paper-soft/75 p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-500">
                  AI 추천
                </p>
                <h2 className="kr-keep mt-1 text-xl font-bold text-ink-900">오늘의 글쓰기 주제 찾기</h2>
                <p className="kr-keep mt-2 text-sm leading-6 text-ink-700">
                  버튼을 누를 때에만 AI를 호출하며, 선택한 학급의 학년에 맞는 주제를 추천합니다.
                </p>
              </div>
              <Badge tone="teacher">
                {selectedClassroom ? `${selectedClassroom.name} · ${grade}학년` : `${grade}학년`}
              </Badge>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <p className="text-sm font-semibold text-ink-700">추천 받을 학년</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {gradeOptions.map((value) => {
                    const isActive = grade === String(value);

                    return (
                      <button
                        key={value}
                        className={`h-9 min-w-[52px] shrink-0 whitespace-nowrap rounded-lg border px-2.5 text-[12px] font-semibold leading-none transition ${
                          isActive
                            ? "border-teacher-accent bg-teacher-accent text-paper-surface"
                            : "border-ink-100 bg-paper-surface text-ink-700 hover:border-teacher-accent/40 hover:bg-teacher-soft/70"
                        }`}
                        type="button"
                        disabled={isTopicWorkDisabled}
                        onClick={() => setGrade(String(value))}
                      >
                        {value}학년
                      </button>
                    );
                  })}
                </div>
              </div>

              <PrimaryButton
                className="w-full lg:w-fit"
                disabled={isGenerating || isTopicWorkDisabled}
                onClick={handleGenerateTopics}
                tone="teacher"
                type="button"
              >
                {isGenerating ? "추천 생성 중..." : suggestedTopics.length > 0 ? "다시 추천 받기" : "추천 받기"}
              </PrimaryButton>
            </div>

            {!isLoadingClassrooms && !hasClassrooms ? (
              <div className="kr-keep mt-4 rounded-xl border border-teacher-accent/20 bg-teacher-soft/55 px-4 py-3 text-sm leading-6 text-teacher-deep">
                아직 연결할 학급이 없어 AI 추천을 받을 수 없습니다. 먼저 학급을 만들어 주세요.
              </div>
            ) : null}

            {aiError ? (
              <div className="mt-4">
                <NoticeBanner tone="error" title="AI 추천 실패" description={aiError} />
              </div>
            ) : null}

            {suggestedTopics.length > 0 ? (
              <div className="mt-5 space-y-4">
                <p className="kr-keep text-sm font-semibold text-ink-700">
                  추천 결과를 클릭하면 주제 제목과 학생 안내가 바로 입력됩니다.
                </p>

                <div className="grid gap-3">
                  {suggestedTopics.map((suggestion, index) => {
                    const isSelected = selectedSuggestionTitle === suggestion.title;
                    const tiltClass = recommendationTiltClasses[index % recommendationTiltClasses.length];

                    return (
                      <button
                        key={`${suggestion.title}-${index}`}
                        className={`group relative rounded-xl border px-4 py-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:rotate-0 ${
                          isSelected
                            ? "border-teacher-accent bg-teacher-accent/10 text-ink-900 ring-2 ring-teacher-accent/20"
                            : "border-ink-100 bg-paper-surface text-ink-700 hover:bg-paper-base"
                        } ${tiltClass}`}
                        onClick={() => applySuggestedTopic(suggestion)}
                        type="button"
                      >
                        <span className="absolute -top-2 left-5 h-4 w-4 rounded-full bg-student-accent shadow-sm" />
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 text-xs font-semibold text-teacher-accent">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <span>
                            <span className="kr-keep block text-sm font-semibold leading-6">
                              {suggestion.title}
                            </span>
                            {suggestion.studentGuide ? (
                              <span className="kr-keep mt-1 block text-xs leading-5 text-ink-500">
                                {suggestion.studentGuide}
                              </span>
                            ) : null}
                          </span>
                        </div>
                        <span className="mt-3 block text-xs font-semibold text-teacher-accent">
                          {isSelected ? "✓ 옮겨짐" : "이 주제로 옮기기 →"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-lg border border-dashed border-ink-200 bg-paper-base/60 px-5 py-6 text-sm text-ink-500">
                <span className="kr-keep block">
                  {hasClassrooms
                    ? "아직 추천 결과가 없습니다. 학급과 학년을 확인한 뒤 AI 추천을 생성해 보세요."
                    : noClassroomHelp}
                </span>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-ink-100 bg-paper-surface p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-500">
              새 주제 등록
            </p>
            <h2 className="kr-keep mt-1 text-xl font-bold text-ink-900">학생 책장에 펼칠 주제</h2>

            <form className="mt-5 space-y-4" onSubmit={handleCreateTopic}>
              <label className="block text-sm font-semibold text-ink-700">
                주제 제목
                <input
                  className="mt-2 h-11 rounded-md border-ink-100 bg-paper-surface text-sm text-ink-900 placeholder:text-ink-300 focus:border-teacher-accent focus:ring-teacher-accent/20"
                  placeholder="예: 우리 가족과 함께한 주말 이야기"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </label>

              <label className="block text-sm font-semibold text-ink-700">
                학생에게 보여 줄 안내
                <textarea
                  className="mt-2 min-h-[132px] rounded-md border-ink-100 bg-paper-surface text-sm leading-7 text-ink-900 placeholder:text-ink-300 focus:border-teacher-accent focus:ring-teacher-accent/20"
                  placeholder="학생에게 보여 줄 간단한 안내를 적어 주세요."
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={4}
                />
              </label>

              <label className="block text-sm font-semibold text-ink-700">
                학급 연결
                <select
                  className="mt-2 h-11 rounded-md border-ink-100 bg-paper-surface text-sm text-ink-900 focus:border-teacher-accent focus:ring-teacher-accent/20"
                  value={classroomId}
                  disabled={!hasClassrooms}
                  onChange={(event) => {
                    const nextClassroomId = event.target.value;
                    const nextClassroom = classrooms.find(
                      (classroom) => String(classroom.id) === nextClassroomId,
                    );

                    setClassroomId(nextClassroomId);

                    if (nextClassroom) {
                      setGrade(String(nextClassroom.grade));
                    }
                  }}
                >
                  {classrooms.map((classroom) => (
                    <option key={classroom.id} value={classroom.id}>
                      {classroom.name} · {classroom.grade}학년 · {classroom.classCode}
                    </option>
                  ))}
                </select>
                {classrooms.length === 0 ? (
                  <span className="kr-keep mt-2 block text-xs leading-5 text-ink-500">
                    먼저 학급을 만든 뒤 주제를 등록할 수 있습니다.{" "}
                    <Link
                      className="whitespace-nowrap font-semibold text-teacher-accent hover:underline"
                      href="/teacher/classrooms"
                    >
                      학급 만들러 가기
                    </Link>
                  </span>
                ) : (
                  <span className="mt-2 block text-xs leading-5 text-ink-500">
                    선택한 학급 학생에게만 이 주제가 보입니다.
                  </span>
                )}
              </label>

              {message ? <NoticeBanner tone="success" title="주제 등록 완료" description={message} /> : null}
              {error ? <NoticeBanner tone="error" title="주제 등록 실패" description={error} /> : null}

              <div className="flex justify-end">
                <PrimaryButton disabled={isTopicWorkDisabled} tone="teacher" type="submit">
                  주제 저장
                </PrimaryButton>
              </div>
            </form>
          </section>
        </div>

        <section className="rounded-xl border border-ink-100 bg-paper-surface p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-500">
                주제 목록
              </p>
              <h2 className="mt-1 text-xl font-bold text-ink-900">주제 목록</h2>
              <p className="mt-2 text-sm leading-6 text-ink-700">
                학생 책장에 보일 글쓰기 주제입니다.
              </p>
            </div>
            <Badge tone="teacher">{topics.length}개</Badge>
          </div>

          <div className="mt-5 space-y-3">
            {isLoadingTopics ? (
              <div className="rounded-xl border border-dashed border-ink-200 bg-paper-base/60 px-6 py-12 text-center text-sm text-ink-500">
                주제 목록을 불러오는 중입니다...
              </div>
            ) : null}

            {!isLoadingTopics && topics.length === 0 ? (
              <div className="rounded-xl border border-dashed border-ink-200 bg-paper-base/60 px-6 py-12 text-center">
                <p className="kr-keep text-lg font-semibold text-ink-900">
                  {hasClassrooms ? "이 학급에 등록된 주제가 없습니다." : "먼저 학급을 만들어주세요"}
                </p>
                <p className="kr-keep mt-2 text-sm text-ink-700">
                  {hasClassrooms
                    ? "첫 주제를 만들면 선택한 학급의 학생 책장에서 바로 볼 수 있습니다."
                    : noClassroomHelp}
                </p>
                {!hasClassrooms ? (
                  <Link
                    className="mt-5 inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-md bg-teacher-accent px-[18px] py-[13px] text-[15px] font-semibold text-paper-surface hover:bg-teacher-accent/90"
                    href="/teacher/classrooms"
                  >
                    학급 만들러 가기
                  </Link>
                ) : null}
              </div>
            ) : null}

            {!isLoadingTopics
              ? topics.map((topic) => (
                  <article
                    key={topic.id}
                    className="rounded-xl border border-ink-100 bg-paper-base/45 p-4 transition hover:bg-paper-base/70"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone="teacher">{topic.grade}학년</Badge>
                          <span className="text-xs font-semibold text-ink-500">
                            {formatTopicDate(topic.createdAt)}
                          </span>
                        </div>
                        <h3 className="kr-keep mt-3 text-lg font-bold leading-tight text-ink-900">
                          {topic.title}
                        </h3>
                      </div>
                    </div>
                    <p className="kr-keep mt-3 text-sm leading-6 text-ink-700">
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
