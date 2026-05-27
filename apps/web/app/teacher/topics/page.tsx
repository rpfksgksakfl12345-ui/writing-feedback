"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
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
  neisOfficeCode: string | null;
  neisOfficeName: string | null;
  neisSchoolCode: string | null;
  neisSchoolName: string | null;
  neisSchoolLevel: string | null;
  neisSchoolAddress: string | null;
  neisSchoolHomepage: string | null;
};

type TopicSuggestion = {
  title: string;
  studentGuide: string;
};

type TopicSuggestionResult = {
  topics: Array<string | Partial<TopicSuggestion>>;
  publicData?: {
    schoolContextUsed: boolean;
    schoolName?: string;
    scheduleCount?: number;
    warning?: string;
    reason?: string;
  };
};

type TopicGuideResult = {
  studentGuide: string;
};

type NeisSchedulePreview = {
  date: string;
  dateLabel: string;
  eventName: string;
  eventContent: string | null;
  gradeNumbers: number[];
};

type ClassroomScheduleResult = {
  schedules: NeisSchedulePreview[];
};

function normalizeGuideText(value: string | null | undefined) {
  return (value ?? "")
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
}

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
    typeof value.studentGuide === "string" ? normalizeGuideText(value.studentGuide) : "";

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

function getSuggestionGuideCacheKey(grade: string, title: string) {
  return `${grade}:${title.trim().toLocaleLowerCase("ko-KR")}`;
}

function isGuideHeading(value: string) {
  return /^(생각해 볼 질문|첫 문장 힌트)\s*:/u.test(value.trim());
}

function isGuideQuestionLine(value: string) {
  return /^\d+[.)]\s+/.test(value.trim());
}

function GuideScaffoldText({
  text,
  compact = false,
}: {
  text: string | null | undefined;
  compact?: boolean;
}) {
  const lines =
    normalizeGuideText(text)
      .split("\n")
      .map((line) => line.trimEnd()) ?? [];
  const visibleLines = lines.filter((line) => line.trim());

  if (visibleLines.length === 0) {
    return null;
  }

  return (
    <div
      className={`kr-keep whitespace-pre-line text-sm leading-6 ${
        compact ? "mt-2 max-h-40 overflow-hidden text-ink-500" : "text-ink-700"
      }`}
    >
      {visibleLines.map((line, index) => {
        const trimmed = line.trim();
        const isHeading = isGuideHeading(trimmed);
        const isQuestion = isGuideQuestionLine(trimmed);

        return (
          <p
            className={`${index > 0 ? "mt-1.5" : ""} ${
              isHeading ? "font-semibold text-ink-800" : ""
            } ${isQuestion ? "pl-4 -indent-4" : ""}`}
            key={`${trimmed}-${index}`}
          >
            {trimmed}
          </p>
        );
      })}
    </div>
  );
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
  const [isRefining, setIsRefining] = useState(false);
  const [refinementInstruction, setRefinementInstruction] = useState("");
  const [refinementError, setRefinementError] = useState("");
  const [isLoadingTopics, setIsLoadingTopics] = useState(true);
  const [isLoadingClassrooms, setIsLoadingClassrooms] = useState(true);
  const [isLoadingSchedules, setIsLoadingSchedules] = useState(false);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [schedulePreview, setSchedulePreview] = useState<NeisSchedulePreview[]>([]);
  const [schedulePreviewError, setSchedulePreviewError] = useState("");
  const [suggestedTopics, setSuggestedTopics] = useState<TopicSuggestion[]>([]);
  const [selectedSuggestionTitle, setSelectedSuggestionTitle] = useState("");
  const selectedSuggestionTitleRef = useRef("");
  const [generatingGuideTitle, setGeneratingGuideTitle] = useState("");
  const [guideGenerationError, setGuideGenerationError] = useState("");
  const [generatedGuidesByKey, setGeneratedGuidesByKey] = useState<Record<string, string>>({});
  const [publicDataNotice, setPublicDataNotice] = useState("");

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

  useEffect(() => {
    selectedSuggestionTitleRef.current = selectedSuggestionTitle;
  }, [selectedSuggestionTitle]);

  function clearSuggestionState() {
    setSuggestedTopics([]);
    setSelectedSuggestionTitle("");
    selectedSuggestionTitleRef.current = "";
    setPublicDataNotice("");
    setAiError("");
    setRefinementError("");
    setGuideGenerationError("");
    setGeneratingGuideTitle("");
    setGeneratedGuidesByKey({});
    setRefinementInstruction("");
  }

  function handleSelectClassroom(nextClassroomId: string) {
    const nextClassroom = classrooms.find(
      (classroom) => String(classroom.id) === nextClassroomId,
    );

    setClassroomId(nextClassroomId);
    setTitle("");
    setDescription("");
    setMessage("");
    clearSuggestionState();

    if (nextClassroom) {
      setGrade(String(nextClassroom.grade));
    }
  }

  useEffect(() => {
    const selected = classrooms.find((classroom) => String(classroom.id) === classroomId) ?? null;

    if (!token || !selected?.neisOfficeCode || !selected.neisSchoolCode) {
      setSchedulePreview([]);
      setSchedulePreviewError("");
      setIsLoadingSchedules(false);
      return;
    }

    let isCancelled = false;
    const selectedClassroomId = selected.id;

    async function loadSchedulePreview() {
      setIsLoadingSchedules(true);
      setSchedulePreviewError("");

      try {
        const response = await apiFetch<ClassroomScheduleResult>(
          `/api/classrooms/${selectedClassroomId}/neis-schedules`,
          { token },
        );

        if (!isCancelled) {
          setSchedulePreview(response.schedules.slice(0, 3));
        }
      } catch (scheduleError) {
        if (!isCancelled) {
          setSchedulePreview([]);
          setSchedulePreviewError(
            scheduleError instanceof Error
              ? scheduleError.message
              : "학사일정 미리보기를 불러오지 못했습니다.",
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingSchedules(false);
        }
      }
    }

    void loadSchedulePreview();

    return () => {
      isCancelled = true;
    };
  }, [classroomId, classrooms, token]);

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
      selectedSuggestionTitleRef.current = "";
      setGuideGenerationError("");
      setGeneratingGuideTitle("");
      setGeneratedGuidesByKey({});
      setMessage("우리 반 주제가 만들어졌어요. 학생 책장에서 바로 확인할 수 있습니다.");
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
    if (!token || isGenerating || isRefining || generatingGuideTitle) {
      return;
    }

    if (!classroomId) {
      setAiError("추천을 받기 전에 학급을 먼저 만들어 주세요.");
      return;
    }

    setAiError("");
    setRefinementError("");
    setGuideGenerationError("");
    setGeneratingGuideTitle("");
    setGeneratedGuidesByKey({});
    setMessage("");
    setPublicDataNotice("");
    setIsGenerating(true);

    try {
      const response = await apiFetch<TopicSuggestionResult>("/api/topics/generate", {
        method: "POST",
        token,
        body: JSON.stringify({ grade: Number(grade), classroomId: Number(classroomId) }),
      });

      setSuggestedTopics(normalizeTopicSuggestions(response.topics));
      setSelectedSuggestionTitle("");
      selectedSuggestionTitleRef.current = "";
      setPublicDataNotice(
        response.publicData?.schoolContextUsed
          ? `${response.publicData.schoolName ?? "연결 학교"} 학사일정을 우리 반 주제 추천에 반영했어요.`
          : response.publicData?.warning
            ? `학교 공공데이터는 반영하지 못했지만 일반 추천은 생성했어요. (${response.publicData.warning})`
            : "",
      );
    } catch (generateError) {
      setSuggestedTopics([]);
      setSelectedSuggestionTitle("");
      selectedSuggestionTitleRef.current = "";
      setPublicDataNotice("");
      setAiError(
        generateError instanceof Error
          ? generateError.message
          : "우리 반 주제 추천에 실패했습니다. 잠시 후 다시 시도해 주세요.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleRefineTopics() {
    if (!token || isGenerating || isRefining || generatingGuideTitle) {
      return;
    }

    if (!classroomId) {
      setRefinementError("다시 추천받기 전에 학급을 먼저 만들어 주세요.");
      return;
    }

    if (suggestedTopics.length === 0) {
      setRefinementError("먼저 우리 반 주제를 추천받은 뒤, 아쉬운 점을 적어 주세요.");
      return;
    }

    const teacherFeedback = refinementInstruction.trim();

    if (!teacherFeedback) {
      setRefinementError("추천에 반영할 의견을 한 문장 이상 적어 주세요.");
      return;
    }

    setAiError("");
    setRefinementError("");
    setGuideGenerationError("");
    setGeneratingGuideTitle("");
    setGeneratedGuidesByKey({});
    setMessage("");
    setPublicDataNotice("");
    setIsRefining(true);

    try {
      const response = await apiFetch<TopicSuggestionResult>("/api/topics/generate", {
        method: "POST",
        token,
        body: JSON.stringify({
          grade: Number(grade),
          classroomId: Number(classroomId),
          teacherFeedback,
          previousSuggestions: suggestedTopics,
        }),
      });

      setSuggestedTopics(normalizeTopicSuggestions(response.topics));
      setSelectedSuggestionTitle("");
      selectedSuggestionTitleRef.current = "";
      setPublicDataNotice(
        response.publicData?.schoolContextUsed
          ? `${response.publicData.schoolName ?? "연결 학교"} 학사일정을 다시 반영했어요.`
          : response.publicData?.warning
            ? `학교 공공데이터는 반영하지 못했지만 다시 추천했어요. (${response.publicData.warning})`
            : "",
      );
      setRefinementInstruction("");
      setRefinementInstruction("");
    } catch {
      setPublicDataNotice("");
      setRefinementError("주제를 다시 추천하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setIsRefining(false);
    }
  }

  async function applySuggestedTopic(suggestion: TopicSuggestion) {
    const fallbackGuide =
      suggestion.studentGuide ||
      `${grade}학년 학생이 300자 이내로 쓰기 좋은 글쓰기 주제입니다.`;
    const requestTitle = suggestion.title;
    const cacheKey = getSuggestionGuideCacheKey(grade, requestTitle);
    const cachedGuide = generatedGuidesByKey[cacheKey];

    setSelectedSuggestionTitle(requestTitle);
    selectedSuggestionTitleRef.current = requestTitle;
    setTitle(requestTitle);
    setDescription(cachedGuide || fallbackGuide);
    setAiError("");
    setGuideGenerationError("");

    if (cachedGuide || !token || !classroomId) {
      return;
    }

    setGeneratingGuideTitle(requestTitle);

    try {
      const response = await apiFetch<TopicGuideResult>("/api/topics/generate-guide", {
        method: "POST",
        token,
        body: JSON.stringify({
          grade: Number(grade),
          classroomId: Number(classroomId),
          title: requestTitle,
          shortGuide: fallbackGuide,
        }),
      });
      const detailedGuide = normalizeGuideText(response.studentGuide);

      if (!detailedGuide) {
        throw new Error("Empty guide");
      }

      setGeneratedGuidesByKey((current) => ({
        ...current,
        [cacheKey]: detailedGuide,
      }));

      if (selectedSuggestionTitleRef.current === requestTitle) {
        setDescription(detailedGuide);
      }
    } catch {
      if (selectedSuggestionTitleRef.current === requestTitle) {
        setGuideGenerationError(
          "상세 안내문을 만들지 못해 짧은 안내문을 넣어 두었습니다. 필요하면 직접 수정해 주세요.",
        );
      }
    } finally {
      setGeneratingGuideTitle((current) => (current === requestTitle ? "" : current));
    }
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
  const isGeneratingGuide = Boolean(generatingGuideTitle);
  const selectedSuggestedTopic = suggestedTopics.find(
    (suggestion) => suggestion.title === selectedSuggestionTitle,
  );
  const isSelectedGuideGenerating =
    Boolean(selectedSuggestionTitle) && generatingGuideTitle === selectedSuggestionTitle;
  const noClassroomHelp =
    "학급을 만든 뒤, 그 학급에 보여줄 글쓰기 주제를 만들 수 있어요.";

  return (
    <div className="overflow-hidden rounded-[28px] border border-ink-100 bg-paper-soft shadow-[0_1px_2px_rgba(60,40,20,.06),0_14px_34px_rgba(60,40,20,.08)]">
      <section className="bg-paper-surface bg-[radial-gradient(rgba(90,110,133,.07)_1px,transparent_1px)] bg-[length:24px_24px] px-8 pb-7 pt-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-sm font-semibold text-teacher-accent">우리 반 맥락 주제 추천</p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-ink-900">
              학교 일정과 우리 반 주제
            </h1>
            <p className="kr-keep mt-3 max-w-2xl text-sm leading-6 text-ink-700">
              공공데이터로 가져온 학교 일정과 학년, 시기 맥락을 참고해 학생 책장에 보낼 글쓰기 주제를 준비합니다.
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
                  우리 반 맥락 추천
                </p>
                <h2 className="kr-keep mt-1 text-xl font-bold text-ink-900">
                  우리 학교 경험을 글감으로 연결하기
                </h2>
                <p className="kr-keep mt-2 text-sm leading-6 text-ink-700">
                  선택한 학급의 학년, 시기, 가까운 학교 행사 맥락을 참고해 담임이 고를 수 있는 주제를 제안합니다.
                </p>
              </div>
              <Badge tone="teacher">
                {selectedClassroom ? `${selectedClassroom.name} · ${grade}학년` : `${grade}학년`}
              </Badge>
            </div>

            <div className="mt-4 rounded-xl border border-teacher-accent/20 bg-paper-surface/85 px-4 py-3 shadow-sm">
              <label className="block text-sm font-semibold text-ink-700" htmlFor="topicClassroomId">
                학급 선택
              </label>
              <select
                className="mt-2 h-11 rounded-md border-ink-100 bg-paper-surface text-sm text-ink-900 focus:border-teacher-accent focus:ring-teacher-accent/20"
                id="topicClassroomId"
                value={classroomId}
                disabled={!hasClassrooms || isGenerating || isRefining || isGeneratingGuide}
                onChange={(event) => handleSelectClassroom(event.target.value)}
              >
                {classrooms.map((classroom) => (
                  <option key={classroom.id} value={classroom.id}>
                    {classroom.name} · {classroom.grade}학년 · {classroom.classCode}
                  </option>
                ))}
              </select>
              <p className="kr-keep mt-2 text-xs leading-5 text-ink-500">
                선택한 학급 기준으로 주제 목록, 추천 결과, 저장 범위가 분리됩니다.
              </p>
            </div>

            <div className="kr-keep mt-4 rounded-xl border border-teacher-accent/20 bg-paper-surface/80 px-4 py-3 text-sm leading-6 text-ink-700">
              {selectedClassroom?.neisSchoolName ? (
                <>
                  <p className="font-bold text-ink-900">
                    학교 일정 맥락 참고 중: {selectedClassroom.neisSchoolName}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-ink-600">
                    공공데이터로 불러온 학교 일정을 담임의 주제 만들기에 참고합니다.
                  </p>
                  {isLoadingSchedules ? (
                    <p className="mt-2 text-xs font-semibold text-teacher-deep">
                      가까운 학교 일정을 확인하는 중입니다...
                    </p>
                  ) : null}
                  {!isLoadingSchedules && schedulePreview.length > 0 ? (
                    <ul className="mt-2 grid gap-1 text-xs leading-5 text-ink-600">
                      {schedulePreview.map((schedule) => (
                        <li key={`${schedule.date}-${schedule.eventName}`}>
                          {schedule.dateLabel} · {schedule.eventName}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {!isLoadingSchedules && schedulePreview.length === 0 && !schedulePreviewError ? (
                    <p className="mt-2 text-xs leading-5 text-ink-500">
                      가까운 학교 일정이 없어도 학년과 시기 중심으로 추천합니다.
                    </p>
                  ) : null}
                  {schedulePreviewError ? (
                    <p className="mt-2 text-xs font-semibold text-status-error">
                      {schedulePreviewError}
                    </p>
                  ) : null}
                </>
              ) : (
                <>
                  <p className="font-bold text-ink-900">학교 일정 연결 전</p>
                  <p className="mt-1 text-xs leading-5 text-ink-600">
                    학교 일정이 없어도 학년과 시기 중심으로 추천할 수 있어요. 학급 관리에서 학교를 연결하면 학교 행사와 교실 경험을 글감으로 더 쉽게 연결합니다.
                  </p>
                </>
              )}
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
                        disabled={isTopicWorkDisabled || isGenerating || isRefining || isGeneratingGuide}
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
                disabled={isGenerating || isRefining || isGeneratingGuide || isTopicWorkDisabled}
                onClick={handleGenerateTopics}
                tone="teacher"
                type="button"
              >
                {isGenerating ? "추천 생성 중..." : suggestedTopics.length > 0 ? "다시 추천 받기" : "우리 반 주제 추천받기"}
              </PrimaryButton>
            </div>

            {!isLoadingClassrooms && !hasClassrooms ? (
              <div className="kr-keep mt-4 rounded-xl border border-teacher-accent/20 bg-teacher-soft/55 px-4 py-3 text-sm leading-6 text-teacher-deep">
                아직 연결할 학급이 없어 우리 반 맥락 추천을 받을 수 없습니다. 먼저 학급을 만들어 주세요.
              </div>
            ) : null}

            {aiError ? (
              <div className="mt-4">
                <NoticeBanner tone="error" title="주제 추천 실패" description={aiError} />
              </div>
            ) : null}
            {publicDataNotice ? (
              <div className="mt-4">
                <NoticeBanner tone="success" title="학교 일정 맥락 확인" description={publicDataNotice} />
              </div>
            ) : null}

            {suggestedTopics.length > 0 ? (
              <div className="mt-5 space-y-4">
                <p className="kr-keep text-sm font-semibold text-ink-700">
                  먼저 짧은 설명으로 주제를 고르고, 선택한 주제만 자세한 질문과 첫 문장 힌트를 만듭니다.
                </p>

                <div className="grid gap-2">
                  {suggestedTopics.map((suggestion, index) => {
                    const isSelected = selectedSuggestionTitle === suggestion.title;
                    const isGeneratingThisGuide = generatingGuideTitle === suggestion.title;

                    return (
                      <button
                        key={`${suggestion.title}-${index}`}
                        className={`group rounded-lg border px-3 py-3 text-left shadow-sm transition hover:-translate-y-0.5 ${
                          isSelected
                            ? "border-teacher-accent bg-teacher-accent/10 text-ink-900 ring-2 ring-teacher-accent/20"
                            : "border-ink-100 bg-paper-surface text-ink-700 hover:bg-paper-base"
                        }`}
                        disabled={isGenerating || isRefining}
                        onClick={() => void applySuggestedTopic(suggestion)}
                        type="button"
                      >
                        <div className="grid grid-cols-[32px_1fr_auto] items-start gap-3">
                          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-teacher-soft text-xs font-bold text-teacher-accent">
                            {index + 1}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="kr-keep block text-sm font-semibold leading-6">
                              {suggestion.title}
                            </span>
                            <span className="kr-keep mt-1 line-clamp-2 text-xs leading-5 text-ink-500">
                              {suggestion.studentGuide ||
                                "선택하면 학생 안내문을 자세히 만들어 줍니다."}
                            </span>
                          </span>
                          <span className="whitespace-nowrap pt-1 text-xs font-semibold text-teacher-accent">
                            {isGeneratingThisGuide ? "안내 생성 중" : isSelected ? "선택됨" : "선택"}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {selectedSuggestedTopic ? (
                  <div className="rounded-lg border border-teacher-accent/20 bg-paper-surface/85 px-4 py-3 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">
                      선택한 주제 상세
                    </p>
                    <h3 className="kr-keep mt-1 text-base font-bold leading-6 text-ink-900">
                      {selectedSuggestedTopic.title}
                    </h3>
                    {isSelectedGuideGenerating ? (
                      <p className="kr-keep mt-2 text-sm font-semibold leading-6 text-teacher-deep">
                        생각을 펼칠 질문을 만드는 중...
                      </p>
                    ) : guideGenerationError ? (
                      <p className="kr-keep mt-2 text-sm font-semibold leading-6 text-status-error">
                        {guideGenerationError}
                      </p>
                    ) : (
                      <div className="mt-2 max-h-48 overflow-auto pr-1">
                        <GuideScaffoldText text={description} />
                      </div>
                    )}
                  </div>
                ) : null}

                <div className="rounded-xl border border-teacher-accent/20 bg-paper-surface/85 p-4 shadow-sm">
                  <p className="kr-keep text-sm font-bold text-ink-900">
                    추천 방향 다듬기
                  </p>
                  <p className="kr-keep mt-2 text-sm leading-6 text-ink-700">
                    추천받은 주제가 조금 아쉽다면 원하는 방향을 적어 주세요. 그 의견을 반영해 다시 추천합니다.
                  </p>
                  <textarea
                    className="mt-3 min-h-[96px] rounded-md border-ink-100 bg-paper-surface text-sm leading-6 text-ink-900 placeholder:text-ink-300 focus:border-teacher-accent focus:ring-teacher-accent/20"
                    disabled={isGenerating || isRefining || isGeneratingGuide || isTopicWorkDisabled}
                    onChange={(event) => {
                      setRefinementInstruction(event.target.value);

                      if (event.target.value.trim()) {
                        setRefinementError("");
                      }
                    }}
                    placeholder="예: 5학년 아이들이 자기 경험을 바탕으로 쓸 수 있게 더 쉽게 바꿔줘."
                    value={refinementInstruction}
                  />
                  {refinementError ? (
                    <p className="kr-keep mt-2 text-sm font-semibold leading-6 text-status-error">
                      {refinementError}
                    </p>
                  ) : null}
                  <div className="mt-3 flex justify-end">
                    <PrimaryButton
                      disabled={
                        isGenerating ||
                        isRefining ||
                        isGeneratingGuide ||
                        isTopicWorkDisabled ||
                        !refinementInstruction.trim()
                      }
                      onClick={handleRefineTopics}
                      tone="teacher"
                      type="button"
                    >
                      {isRefining ? "의견 반영 중..." : "이 의견 반영해서 다시 추천받기"}
                    </PrimaryButton>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-lg border border-dashed border-ink-200 bg-paper-base/60 px-5 py-6 text-sm text-ink-500">
                <span className="kr-keep block">
                  {hasClassrooms
                    ? "아직 추천 결과가 없습니다. 학급과 학년을 확인한 뒤 우리 반 주제를 추천받아 보세요."
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
                  className="mt-2 min-h-[220px] resize-y whitespace-pre-wrap rounded-md border-ink-100 bg-paper-surface text-sm leading-7 text-ink-900 placeholder:text-ink-300 focus:border-teacher-accent focus:ring-teacher-accent/20"
                  placeholder="학생에게 보여 줄 간단한 안내를 적어 주세요."
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={8}
                />
                {isSelectedGuideGenerating ? (
                  <span className="kr-keep mt-2 block text-xs font-semibold leading-5 text-teacher-deep">
                    선택한 주제의 생각해 볼 질문과 첫 문장 힌트를 만드는 중입니다.
                  </span>
                ) : guideGenerationError ? (
                  <span className="kr-keep mt-2 block text-xs font-semibold leading-5 text-status-error">
                    {guideGenerationError}
                  </span>
                ) : null}
              </label>

              <label className="block text-sm font-semibold text-ink-700">
                학급 연결
                <select
                  className="mt-2 h-11 rounded-md border-ink-100 bg-paper-surface text-sm text-ink-900 focus:border-teacher-accent focus:ring-teacher-accent/20"
                  value={classroomId}
                  disabled={!hasClassrooms || isGenerating || isRefining || isGeneratingGuide}
                  onChange={(event) => handleSelectClassroom(event.target.value)}
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
                <PrimaryButton disabled={isTopicWorkDisabled || isGeneratingGuide} tone="teacher" type="submit">
                  우리 반 주제 만들기
                </PrimaryButton>
              </div>
            </form>
          </section>
        </div>

        <section className="rounded-xl border border-ink-100 bg-paper-surface p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-500">
                학생 책장 주제
              </p>
              <h2 className="mt-1 text-xl font-bold text-ink-900">학생에게 보이는 주제</h2>
              <p className="mt-2 text-sm leading-6 text-ink-700">
                학생 책장에 꽂힌 주제와 글쓰기 안내입니다.
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
                  {hasClassrooms ? "우리 반 첫 글쓰기 주제를 만들어볼까요?" : "먼저 학급을 만들어주세요"}
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
                    {topic.description ? (
                      <GuideScaffoldText compact text={topic.description} />
                    ) : (
                      <p className="kr-keep mt-3 text-sm leading-6 text-ink-700">설명 없음</p>
                    )}
                  </article>
                ))
              : null}
          </div>
        </section>
      </section>
    </div>
  );
}
