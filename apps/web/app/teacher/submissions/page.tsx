"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { NoticeBanner } from "../../../components/notice-banner";
import { useAuth } from "../../../components/auth-provider";
import { Badge, PrimaryButton, SecondaryButton } from "../../../components/ui-v2";
import { apiFetch } from "../../../lib/api";

type SubmissionItem = {
  id: number;
  inputType: "TYPED" | "PHOTO";
  imageUrl: string | null;
  content: string | null;
  ocrStatus: "NONE" | "PROCESSING" | "DONE" | "FAILED";
  ocrExtractedText: string | null;
  editedExtractedText: string | null;
  extractedText: string | null;
  aiFeedback: string | null;
  status: "PENDING" | "REVIEWED";
  finalFeedback: string | null;
  createdAt: string;
  student: { id: number; name: string; grade: number | null };
  topic: { id: number; title: string; grade: number; classroomId?: number | null };
};

type ClassroomSummary = {
  id: number;
  name: string;
  grade: number;
};

type TopicSummary = {
  id: number;
  title: string;
  grade: number;
  classroomId: number | null;
};

type StudentRosterItem = {
  id: number;
  userId: number;
  name: string;
  grade: number | null;
  studentNumber: number;
};

type BulkUploadItem = {
  studentId: number;
  studentName?: string;
  submissionId?: number;
  ocrText?: string;
  reason?: string;
};

type BulkUploadResponse = {
  created: BulkUploadItem[];
  skipped: BulkUploadItem[];
  failed: BulkUploadItem[];
};

type BulkFeedbackResponse = {
  summary: {
    requested: number;
    generated: number;
    skipped: number;
    failed: number;
    aiCalls: number;
  };
  generated: Array<{ submissionId: number; feedback: string }>;
  skipped: Array<{ submissionId: number; reason: string }>;
  failed: Array<{ submissionId: number; reason: string }>;
};

function getStatusMeta(status: SubmissionItem["status"]) {
  if (status === "REVIEWED") {
    return {
      label: "피드백 완료",
      tone: "feedback" as const,
      description: "담임 피드백이 학생에게 저장되었습니다.",
    };
  }

  return {
    label: "피드백 대기",
    tone: "student" as const,
    description: "글 확인과 담임 피드백 작성이 필요합니다.",
  };
}

function formatSubmissionDate(createdAt: string) {
  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    return "제출 시점 정보 없음";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getPreferredSubmissionText(submission: SubmissionItem) {
  if (submission.inputType === "TYPED") {
    return submission.content?.trim() || "";
  }

  return (
    submission.editedExtractedText?.trim() ||
    submission.ocrExtractedText?.trim() ||
    submission.extractedText?.trim() ||
    ""
  );
}

function hasAnyFeedback(submission: SubmissionItem) {
  return Boolean(submission.finalFeedback?.trim() || submission.aiFeedback?.trim());
}

function canGenerateBulkFeedbackFor(submission: SubmissionItem) {
  if (hasAnyFeedback(submission)) {
    return false;
  }

  if (submission.inputType === "PHOTO" && submission.ocrStatus !== "DONE") {
    return false;
  }

  return Boolean(getPreferredSubmissionText(submission));
}

function getResultItemLabel(item: BulkUploadItem) {
  return item.studentName || (item.studentId ? `학생 ${item.studentId}` : "학생 정보 없음");
}

function TeacherSubmissionsContent() {
  const searchParams = useSearchParams();
  const { token, user, isReady } = useAuth();
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  const [classrooms, setClassrooms] = useState<ClassroomSummary[]>([]);
  const [topics, setTopics] = useState<TopicSummary[]>([]);
  const [students, setStudents] = useState<StudentRosterItem[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState(searchParams.get("topicId") || "");
  const [studentFiles, setStudentFiles] = useState<Record<number, File | null>>({});
  const [fileInputResetKey, setFileInputResetKey] = useState(0);
  const [error, setError] = useState("");
  const [studentLoadError, setStudentLoadError] = useState("");
  const [bulkUploadError, setBulkUploadError] = useState("");
  const [bulkFeedbackError, setBulkFeedbackError] = useState("");
  const [bulkUploadResult, setBulkUploadResult] = useState<BulkUploadResponse | null>(null);
  const [bulkFeedbackResult, setBulkFeedbackResult] = useState<BulkFeedbackResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const [isBulkGeneratingFeedback, setIsBulkGeneratingFeedback] = useState(false);
  const [isBulkFeedbackConfirmOpen, setIsBulkFeedbackConfirmOpen] = useState(false);
  const saved = searchParams.get("saved") === "1";

  async function loadTeacherContext() {
    if (!token) {
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const [nextSubmissions, nextClassrooms, nextTopics] = await Promise.all([
        apiFetch<SubmissionItem[]>("/api/submissions", { token }),
        apiFetch<ClassroomSummary[]>("/api/classrooms", { token }),
        apiFetch<TopicSummary[]>("/api/topics", { token }),
      ]);

      setSubmissions(nextSubmissions);
      setClassrooms(nextClassrooms);
      setTopics(nextTopics);
      setSelectedTopicId((currentTopicId) => {
        if (currentTopicId && nextTopics.some((topic) => String(topic.id) === currentTopicId)) {
          return currentTopicId;
        }

        return nextTopics[0] ? String(nextTopics[0].id) : "";
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "제출 글을 불러오지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadTeacherContext();
  }, [token]);

  const selectedTopic = useMemo(
    () => topics.find((topic) => String(topic.id) === selectedTopicId) ?? null,
    [selectedTopicId, topics],
  );
  const selectedClassroom = useMemo(
    () =>
      selectedTopic?.classroomId
        ? classrooms.find((classroom) => classroom.id === selectedTopic.classroomId) ?? null
        : null,
    [classrooms, selectedTopic?.classroomId],
  );
  const selectedTopicSubmissions = useMemo(
    () =>
      selectedTopic
        ? submissions.filter((submission) => submission.topic.id === selectedTopic.id)
        : submissions,
    [selectedTopic, submissions],
  );
  const submissionByStudentId = useMemo(() => {
    const submissionMap = new Map<number, SubmissionItem>();

    for (const submission of selectedTopicSubmissions) {
      if (!submissionMap.has(submission.student.id)) {
        submissionMap.set(submission.student.id, submission);
      }
    }

    return submissionMap;
  }, [selectedTopicSubmissions]);

  useEffect(() => {
    if (!token || !selectedTopic?.classroomId) {
      setStudents([]);
      setStudentLoadError("");
      return;
    }

    let ignore = false;
    setIsLoadingStudents(true);
    setStudentLoadError("");

    apiFetch<StudentRosterItem[]>(`/api/classrooms/${selectedTopic.classroomId}/students`, { token })
      .then((nextStudents) => {
        if (!ignore) {
          setStudents(nextStudents);
        }
      })
      .catch((loadError) => {
        if (!ignore) {
          setStudents([]);
          setStudentLoadError(
            loadError instanceof Error ? loadError.message : "학생 명단을 불러오지 못했습니다.",
          );
        }
      })
      .finally(() => {
        if (!ignore) {
          setIsLoadingStudents(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [selectedTopic?.classroomId, token]);

  if (isReady && user?.role !== "TEACHER") {
    return (
      <section className="rounded-xl border border-ink-100 bg-paper-surface p-6 text-ink-700 shadow-sm">
        교사 계정만 접근할 수 있습니다.
      </section>
    );
  }

  const pendingCount = submissions.filter((submission) => submission.status === "PENDING").length;
  const reviewedCount = submissions.filter((submission) => submission.status === "REVIEWED").length;
  const photoCount = submissions.filter((submission) => submission.inputType === "PHOTO").length;
  const aiDraftCount = submissions.filter(
    (submission) => submission.aiFeedback?.trim() && !submission.finalFeedback?.trim(),
  ).length;
  const hasClassrooms = classrooms.length > 0;
  const hasTopics = topics.length > 0;
  const selectedFilesCount = Object.values(studentFiles).filter(Boolean).length;
  const selectedTopicNoFeedbackCount = selectedTopicSubmissions.filter(
    (submission) => !hasAnyFeedback(submission),
  ).length;
  const selectedTopicReadyFeedbackCount =
    selectedTopicSubmissions.filter(canGenerateBulkFeedbackFor).length;
  const emptyState = !hasClassrooms
    ? {
        title: "먼저 학급을 만들어주세요",
        description:
          "학급을 만들면 학생 계정을 발급하고, 학생들이 글을 제출할 주제를 보낼 수 있어요.",
        href: "/teacher/classrooms",
        action: "학급 만들러 가기",
      }
    : !hasTopics
      ? {
          title: "아직 글쓰기 주제가 없어요",
          description:
            "학급은 준비됐습니다. 첫 주제를 만들면 학생들이 책장에서 글쓰기를 시작할 수 있어요.",
          href: "/teacher/topics",
          action: "주제 만들러 가기",
        }
      : {
          title: selectedTopic ? "선택한 주제에 제출된 글이 없어요" : "아직 검토할 글이 없어요",
          description: selectedTopic
            ? "학생이 직접 제출하거나, 위 사진 수합에서 학생 공책 사진을 대신 올릴 수 있어요."
            : "학생들이 글을 제출하면 이곳에서 읽고 피드백을 남길 수 있어요.",
          href: null,
          action: null,
        };

  function handleTopicChange(nextTopicId: string) {
    setSelectedTopicId(nextTopicId);
    setStudentFiles({});
    setBulkUploadResult(null);
    setBulkFeedbackResult(null);
    setBulkUploadError("");
    setBulkFeedbackError("");
    setIsBulkFeedbackConfirmOpen(false);
    setFileInputResetKey((current) => current + 1);
  }

  function handleStudentFileChange(studentId: number, file: File | null) {
    setStudentFiles((current) => ({ ...current, [studentId]: file }));
    setBulkUploadResult(null);
    setBulkUploadError("");
  }

  async function handleBulkUpload() {
    if (!token || !selectedTopic || isBulkUploading) {
      return;
    }

    const selectedEntries = students
      .map((student) => ({ student, file: studentFiles[student.userId] }))
      .filter((entry): entry is { student: StudentRosterItem; file: File } => Boolean(entry.file));

    if (selectedEntries.length === 0) {
      setBulkUploadError("올릴 공책 사진을 하나 이상 선택해 주세요.");
      return;
    }

    setBulkUploadError("");
    setBulkUploadResult(null);
    setIsBulkUploading(true);

    const formData = new FormData();
    selectedEntries.forEach(({ student, file }) => {
      formData.append(`studentFile-${student.userId}`, file);
    });

    try {
      const result = await apiFetch<BulkUploadResponse>(
        `/api/topics/${selectedTopic.id}/submissions/bulk-upload`,
        {
          method: "POST",
          token,
          body: formData,
        },
      );

      setBulkUploadResult(result);
      setStudentFiles({});
      setFileInputResetKey((current) => current + 1);
      await loadTeacherContext();
    } catch (uploadError) {
      setBulkUploadError(
        uploadError instanceof Error ? uploadError.message : "공책 사진 올리기에 실패했습니다.",
      );
    } finally {
      setIsBulkUploading(false);
    }
  }

  async function handleBulkFeedback() {
    if (!token || !selectedTopic || isBulkGeneratingFeedback) {
      return;
    }

    if (selectedTopicReadyFeedbackCount === 0) {
      setBulkFeedbackError("AI 초안을 만들 수 있는 제출 글이 없습니다.");
      return;
    }

    setBulkFeedbackError("");
    setBulkFeedbackResult(null);
    setIsBulkFeedbackConfirmOpen(false);
    setIsBulkGeneratingFeedback(true);

    try {
      const result = await apiFetch<BulkFeedbackResponse>(
        `/api/topics/${selectedTopic.id}/feedback-drafts/bulk`,
        {
          method: "POST",
          token,
        },
      );

      setBulkFeedbackResult(result);
      await loadTeacherContext();
    } catch (feedbackError) {
      setBulkFeedbackError(
        feedbackError instanceof Error
          ? feedbackError.message
          : "주제별 AI 초안 생성에 실패했습니다.",
      );
    } finally {
      setIsBulkGeneratingFeedback(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-[28px] border border-ink-100 bg-paper-soft shadow-[0_1px_2px_rgba(60,40,20,.06),0_14px_34px_rgba(60,40,20,.08)]">
      <section className="bg-paper-surface bg-[radial-gradient(rgba(90,110,133,.07)_1px,transparent_1px)] bg-[length:24px_24px] px-8 pb-7 pt-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-sm font-semibold text-teacher-accent">오늘 확인할 글</p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-ink-900">제출 글 확인</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-700">
              공책 사진과 직접 입력 글을 모아 보고, 글 확인, AI 초안, 담임 피드백 저장까지 이어갑니다.
            </p>
          </div>

          <Link
            className="inline-flex min-h-11 w-fit items-center justify-center whitespace-nowrap rounded-md border border-ink-100 bg-paper-surface px-[18px] py-[13px] text-[15px] font-semibold text-ink-900 hover:bg-paper-base"
            href="/teacher/topics"
          >
            우리 반 주제 만들기
          </Link>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-5">
          <div className="rounded-lg border border-ink-100 bg-paper-surface/85 px-4 py-3">
            <p className="text-xs text-ink-500">오늘 모인 글</p>
            <p className="mt-1 text-lg font-semibold text-ink-900">{submissions.length}</p>
          </div>
          <div className="rounded-lg border border-ink-100 bg-paper-surface/85 px-4 py-3">
            <p className="text-xs text-ink-500">피드백 필요한 글</p>
            <p className="mt-1 text-lg font-semibold text-student-accent">{pendingCount}</p>
          </div>
          <div className="rounded-lg border border-ink-100 bg-paper-surface/85 px-4 py-3">
            <p className="text-xs text-ink-500">피드백 완료</p>
            <p className="mt-1 text-lg font-semibold text-feedback-pen">{reviewedCount}</p>
          </div>
          <div className="rounded-lg border border-ink-100 bg-paper-surface/85 px-4 py-3">
            <p className="text-xs text-ink-500">AI 초안 준비</p>
            <p className="mt-1 text-lg font-semibold text-feedback-pen">{aiDraftCount}</p>
          </div>
          <div className="rounded-lg border border-ink-100 bg-paper-surface/85 px-4 py-3">
            <p className="text-xs text-ink-500">공책 사진</p>
            <p className="mt-1 text-lg font-semibold text-teacher-accent">{photoCount}</p>
          </div>
        </div>
      </section>

      <section className="px-8 pb-10 pt-7">
        {saved ? (
          <div className="mb-5">
            <NoticeBanner
              tone="success"
              title="피드백 저장 완료"
              description="담임 피드백을 저장하고 확인할 글 목록으로 돌아왔습니다."
            />
          </div>
        ) : null}

        {error ? (
          <div className="mb-5">
            <NoticeBanner tone="error" title="제출 글 불러오기 실패" description={error} />
          </div>
        ) : null}

        {isLoading ? (
          <div className="rounded-xl border border-dashed border-ink-200 bg-paper-surface px-6 py-14 text-center text-sm text-ink-500">
            제출 글을 불러오는 중입니다...
          </div>
        ) : null}

        {!isLoading && hasClassrooms && hasTopics ? (
          <section className="mb-6 rounded-xl border border-ink-100 bg-paper-surface p-5 shadow-sm">
            <div className="grid gap-4 lg:grid-cols-[minmax(240px,.55fr)_minmax(0,1fr)]">
              <div>
                <label className="block text-sm font-semibold text-ink-700" htmlFor="bulkTopicId">
                  확인할 주제 선택
                </label>
                <select
                  className="mt-2 h-11 rounded-md border-ink-100 bg-paper-surface text-sm text-ink-900 focus:border-teacher-accent focus:ring-teacher-accent/20"
                  id="bulkTopicId"
                  value={selectedTopicId}
                  onChange={(event) => handleTopicChange(event.target.value)}
                >
                  {topics.map((topic) => (
                    <option key={topic.id} value={topic.id}>
                      {topic.title} ({topic.grade}학년)
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs leading-5 text-ink-500">
                  {selectedClassroom
                    ? `${selectedClassroom.name} 학생 명단과 연결됩니다.`
                    : "학급에 연결된 주제를 선택해 주세요."}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-ink-100 bg-paper-base/50 px-4 py-3">
                  <p className="text-xs text-ink-500">선택 주제 글</p>
                  <p className="mt-1 text-lg font-semibold text-ink-900">
                    {selectedTopicSubmissions.length}
                  </p>
                </div>
                <div className="rounded-lg border border-ink-100 bg-paper-base/50 px-4 py-3">
                  <p className="text-xs text-ink-500">담임 피드백 필요</p>
                  <p className="mt-1 text-lg font-semibold text-student-accent">
                    {selectedTopicNoFeedbackCount}
                  </p>
                </div>
                <div className="rounded-lg border border-ink-100 bg-paper-base/50 px-4 py-3">
                  <p className="text-xs text-ink-500">AI 초안 가능</p>
                  <p className="mt-1 text-lg font-semibold text-feedback-pen">
                    {selectedTopicReadyFeedbackCount}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,.8fr)]">
              <div className="rounded-xl border border-dashed border-teacher-accent/30 bg-paper-soft/75 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-500">
                      공책 사진 수합
                    </p>
                    <h2 className="kr-keep mt-1 text-xl font-bold text-ink-900">
                      학생 공책 사진 대신 올리기
                    </h2>
                    <p className="kr-keep mt-2 text-sm leading-6 text-ink-700">
                      학생이 기기를 쓰지 않아도 선생님이 공책 사진을 대신 올릴 수 있어요. 아직 제출이 없는 학생만 선택해 주세요.
                    </p>
                  </div>
                  <Badge tone="teacher">
                    {selectedFilesCount > 0 ? `${selectedFilesCount}개 선택` : "사진 선택"}
                  </Badge>
                </div>

                {studentLoadError ? (
                  <div className="mt-4">
                    <NoticeBanner tone="error" title="학생 명단 불러오기 실패" description={studentLoadError} />
                  </div>
                ) : null}

                {isLoadingStudents ? (
                  <div className="mt-5 rounded-lg border border-dashed border-ink-200 bg-paper-surface px-5 py-8 text-center text-sm text-ink-500">
                    학생 명단을 불러오는 중입니다...
                  </div>
                ) : null}

                {!isLoadingStudents && students.length > 0 ? (
                  <div className="mt-5 max-h-[420px] space-y-2 overflow-auto pr-1">
                    {students.map((student) => {
                      const existingSubmission = submissionByStudentId.get(student.userId);
                      const selectedFile = studentFiles[student.userId];

                      return (
                        <div
                          key={student.userId}
                          className="grid gap-3 rounded-lg border border-ink-100 bg-paper-surface px-4 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(240px,.8fr)] sm:items-center"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-ink-900">
                              {student.studentNumber}번 {student.name}
                            </p>
                            <p className="mt-1 text-xs text-ink-500">
                              {existingSubmission
                                ? "이미 제출 있음"
                                : selectedFile
                                  ? selectedFile.name
                                  : "사진을 선택할 수 있어요."}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <input
                              key={`${fileInputResetKey}-${student.userId}`}
                              className="min-w-0 flex-1 rounded-md border-ink-100 bg-paper-surface text-xs text-ink-700 file:mr-3 file:rounded-md file:border-0 file:bg-teacher-accent file:px-3 file:py-2 file:text-xs file:font-semibold file:text-paper-surface hover:file:bg-teacher-accent/90 disabled:text-ink-300 disabled:file:bg-ink-200"
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              disabled={Boolean(existingSubmission) || isBulkUploading}
                              onChange={(event) =>
                                handleStudentFileChange(student.userId, event.target.files?.[0] || null)
                              }
                            />
                            {existingSubmission ? <Badge tone="neutral">건너뜀</Badge> : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                {!isLoadingStudents && students.length === 0 ? (
                  <div className="mt-5 rounded-lg border border-dashed border-ink-200 bg-paper-surface px-5 py-8 text-center text-sm text-ink-500">
                    이 주제 학급의 학생 명단이 없습니다.
                  </div>
                ) : null}

                {bulkUploadError ? (
                  <div className="mt-4">
                    <NoticeBanner tone="error" title="일괄 업로드 실패" description={bulkUploadError} />
                  </div>
                ) : null}

                {bulkUploadResult ? (
                  <div className="mt-4 rounded-lg border border-ink-100 bg-paper-surface p-4 text-sm">
                    <p className="font-semibold text-ink-900">
                      {bulkUploadResult.created.length}개 생성, {bulkUploadResult.skipped.length}개 건너뜀,{" "}
                      {bulkUploadResult.failed.length}개 실패
                    </p>
                    <div className="mt-3 grid gap-3 lg:grid-cols-3">
                      <div>
                        <p className="text-xs font-semibold text-status-feedbackDone">생성</p>
                        <ul className="mt-2 space-y-1 text-xs text-ink-700">
                          {bulkUploadResult.created.map((item) => (
                            <li key={`created-${item.studentId}-${item.submissionId}`}>
                              {getResultItemLabel(item)}
                            </li>
                          ))}
                          {bulkUploadResult.created.length === 0 ? <li>없음</li> : null}
                        </ul>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-ink-500">건너뜀</p>
                        <ul className="mt-2 space-y-1 text-xs text-ink-700">
                          {bulkUploadResult.skipped.map((item) => (
                            <li key={`skipped-${item.studentId}-${item.submissionId}`}>
                              {getResultItemLabel(item)} · {item.reason}
                            </li>
                          ))}
                          {bulkUploadResult.skipped.length === 0 ? <li>없음</li> : null}
                        </ul>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-status-error">실패</p>
                        <ul className="mt-2 space-y-1 text-xs text-ink-700">
                          {bulkUploadResult.failed.map((item, index) => (
                            <li key={`failed-${item.studentId}-${item.submissionId ?? index}`}>
                              {getResultItemLabel(item)} · {item.reason}
                            </li>
                          ))}
                          {bulkUploadResult.failed.length === 0 ? <li>없음</li> : null}
                        </ul>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="mt-5 flex justify-end">
                  <PrimaryButton
                    disabled={!selectedTopic || selectedFilesCount === 0 || isBulkUploading}
                    onClick={handleBulkUpload}
                    tone="teacher"
                    type="button"
                  >
                    {isBulkUploading ? "사진 속 글을 읽는 중..." : "선택한 공책 사진 올리기"}
                  </PrimaryButton>
                </div>
              </div>

              <div className="rounded-xl border border-feedback-pen/25 bg-feedback-soft p-5 shadow-sm">
                <div className="mb-4 h-1.5 rounded-full bg-feedback-pen/70" />
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-feedback-pen">
                  AI 초안
                </p>
                <h2 className="kr-keep mt-1 text-xl font-bold text-ink-900">
                  이 주제 AI 초안 만들기
                </h2>
                <p className="kr-keep mt-2 text-sm leading-6 text-ink-700">
                  버튼을 누를 때에만 AI를 호출합니다. 담임 피드백이 아직 없는 글에 초안만 준비해 둡니다.
                </p>

                <div className="mt-5 grid gap-3">
                  <div className="rounded-lg border border-feedback-pen/15 bg-paper-surface/75 px-4 py-3">
                    <p className="text-xs text-ink-500">초안 대상</p>
                    <p className="mt-1 text-lg font-semibold text-feedback-pen">
                      {selectedTopicReadyFeedbackCount}개
                    </p>
                  </div>
                  <div className="rounded-lg border border-feedback-pen/15 bg-paper-surface/75 px-4 py-3">
                    <p className="text-xs text-ink-500">건너뛸 수 있는 항목</p>
                    <p className="mt-1 text-sm font-semibold text-ink-900">
                      이미 담임 피드백 있음, 글자 확인 미완료, 텍스트 없음
                    </p>
                  </div>
                </div>

                {bulkFeedbackError ? (
                  <div className="mt-4">
                    <NoticeBanner tone="error" title="AI 초안 생성 실패" description={bulkFeedbackError} />
                  </div>
                ) : null}

                {bulkFeedbackResult ? (
                  <div className="mt-4 rounded-lg border border-feedback-pen/20 bg-paper-surface/85 p-4 text-sm">
                    <p className="font-semibold text-feedback-pen">
                      {bulkFeedbackResult.summary.generated}개 생성,{" "}
                      {bulkFeedbackResult.summary.skipped}개 건너뜀,{" "}
                      {bulkFeedbackResult.summary.failed}개 실패
                    </p>
                    <p className="mt-1 text-xs text-ink-500">
                      AI 호출 {bulkFeedbackResult.summary.aiCalls}회 · 생성된 초안은 글 상세에서 확인하고 담임 피드백으로 저장할 수 있어요.
                    </p>
                    {bulkFeedbackResult.failed.length > 0 ? (
                      <ul className="mt-3 space-y-1 text-xs text-status-error">
                        {bulkFeedbackResult.failed.map((item) => (
                          <li key={`feedback-failed-${item.submissionId}`}>
                            제출 글 {item.submissionId} · {item.reason}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}

                {isBulkGeneratingFeedback ? (
                  <p className="mt-4 text-sm font-semibold text-feedback-pen">
                    여러 글의 AI 초안을 준비하고 있어요.
                  </p>
                ) : null}

                {isBulkFeedbackConfirmOpen ? (
                  <div className="mt-4 rounded-lg border border-feedback-pen/20 bg-feedback-pen/5 p-4">
                    <p className="text-sm font-bold text-feedback-pen">
                      이 주제의 AI 초안을 만들까요?
                    </p>
                    <p className="kr-keep mt-2 text-sm leading-6 text-ink-700">
                      담임 피드백이 아직 없는 글에 대해서만 초안을 만듭니다. 생성된 초안은
                      글 상세에서 선생님이 확인하고 고친 뒤 담임 피드백으로 저장할 수 있어요.
                    </p>
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                      <SecondaryButton
                        className="h-10 min-h-10"
                        onClick={() => setIsBulkFeedbackConfirmOpen(false)}
                        type="button"
                      >
                        취소
                      </SecondaryButton>
                      <PrimaryButton
                        disabled={isBulkGeneratingFeedback}
                        onClick={handleBulkFeedback}
                        tone="teacher"
                        type="button"
                      >
                        {isBulkGeneratingFeedback ? "AI 초안 생성 중..." : "AI 초안 만들기"}
                      </PrimaryButton>
                    </div>
                  </div>
                ) : null}

                {!isBulkFeedbackConfirmOpen ? (
                  <div className="mt-5 flex justify-end">
                    <PrimaryButton
                      disabled={!selectedTopic || selectedTopicReadyFeedbackCount === 0 || isBulkGeneratingFeedback}
                      onClick={() => {
                        setBulkFeedbackError("");
                        setIsBulkFeedbackConfirmOpen(true);
                      }}
                      tone="teacher"
                      type="button"
                    >
                      {isBulkGeneratingFeedback ? "AI 초안 생성 중..." : "이 주제 AI 초안 만들기"}
                    </PrimaryButton>
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        {!isLoading && selectedTopicSubmissions.length === 0 ? (
          <div className="kr-keep rounded-xl border border-dashed border-ink-200 bg-paper-surface px-6 py-14 text-center">
            <p className="text-lg font-semibold text-ink-900">{emptyState.title}</p>
            <p className="mx-auto mt-2 max-w-[560px] text-sm leading-6 text-ink-700">
              {emptyState.description}
            </p>
            {emptyState.href && emptyState.action ? (
              <Link
                className="mt-5 inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-md bg-teacher-accent px-[18px] py-[13px] text-[15px] font-semibold text-paper-surface hover:bg-teacher-accent/90"
                href={emptyState.href}
              >
                {emptyState.action}
              </Link>
            ) : null}
          </div>
        ) : null}

        {!isLoading && selectedTopicSubmissions.length > 0 ? (
          <div className="space-y-4">
            {selectedTopicSubmissions.map((submission) => {
              const statusMeta = getStatusMeta(submission.status);
              const hasFinalFeedback = Boolean(submission.finalFeedback?.trim());
              const hasAiDraft = Boolean(submission.aiFeedback?.trim() && !hasFinalFeedback);
              const isPending = submission.status === "PENDING";

              return (
                <article
                  key={submission.id}
                  className={`grid gap-5 overflow-hidden rounded-xl border bg-paper-surface p-0 shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_12px_26px_rgba(60,40,20,.09)] lg:grid-cols-[1fr_auto] ${
                    isPending
                      ? "border-feedback-pen/25 border-l-[4px] border-l-feedback-pen"
                      : "border-ink-100 border-l-[4px] border-l-status-feedbackDone"
                  }`}
                >
                  <div className="min-w-0 p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
                      <Badge tone={hasFinalFeedback ? "feedback" : hasAiDraft ? "teacher" : "neutral"}>
                        {hasFinalFeedback ? "담임 피드백 완료" : hasAiDraft ? "AI 초안 준비" : "담임 피드백 필요"}
                      </Badge>
                      {submission.inputType === "PHOTO" ? (
                        <Badge tone={submission.ocrStatus === "DONE" ? "success" : "neutral"}>
                          {submission.ocrStatus === "DONE" ? "글자 확인 완료" : "글자 확인 필요"}
                        </Badge>
                      ) : null}
                    </div>

                    <h2 className="mt-3 text-[20px] font-bold leading-tight text-ink-900">
                      {submission.topic.title}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-ink-700">
                      {submission.student.name} / {submission.student.grade ?? "-"}학년 /{" "}
                      {submission.topic.grade}학년 주제
                    </p>
                    <p className="mt-1 text-sm text-ink-500">
                      {formatSubmissionDate(submission.createdAt)} · {statusMeta.description}
                    </p>
                  </div>

                  <div className="flex items-start bg-paper-base/45 p-5 lg:items-center">
                    <Link
                      className={`inline-flex min-h-11 w-full items-center justify-center whitespace-nowrap rounded-md px-[18px] py-[13px] text-[15px] font-semibold text-paper-surface shadow-[0_1px_0_rgba(40,60,90,.15),0_2px_6px_rgba(60,80,120,.18)] lg:w-auto ${
                        isPending
                          ? "bg-teacher-accent hover:bg-teacher-accent/90"
                          : "bg-feedback-pen hover:bg-feedback-pen/90"
                      }`}
                      href={`/teacher/submissions/${submission.id}`}
                    >
                      {isPending ? "피드백 작성하기" : "글 다시 보기"}
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </section>
    </div>
  );
}

export default function TeacherSubmissionsPage() {
  return (
    <Suspense
      fallback={
        <section className="rounded-xl border border-ink-100 bg-paper-surface p-6 text-ink-700 shadow-sm">
          불러오는 중...
        </section>
      }
    >
      <TeacherSubmissionsContent />
    </Suspense>
  );
}
