"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { NoticeBanner } from "../../../components/notice-banner";
import { useAuth } from "../../../components/auth-provider";
import { Badge, NotebookPaper, NotebookText, NotebookTextArea, PrimaryButton } from "../../../components/ui-v2";
import { apiFetch, apiFetchBlob } from "../../../lib/api";

type Topic = {
  id: number;
  title: string;
  description?: string | null;
  grade: number;
  createdAt?: string;
};

type SubmissionInputType = "TYPED" | "PHOTO";
type SubmissionStatus = "PENDING" | "REVIEWED";

type SubmissionItem = {
  id: number;
  topicId?: number;
  inputType: SubmissionInputType;
  imageUrl: string | null;
  content: string | null;
  extractedText?: string | null;
  ocrExtractedText?: string | null;
  editedExtractedText?: string | null;
  status: SubmissionStatus;
  finalFeedback: string | null;
  createdAt: string;
  topic?: {
    id: number;
    title?: string;
    grade?: number;
  };
};

const typedMaxLength = 2000;

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function normalizeGuideText(value: string | null | undefined) {
  return (value ?? "")
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
}

function isGuideHeading(value: string) {
  return /^(생각해 볼 질문|첫 문장 힌트)\s*:/u.test(value.trim());
}

function isGuideQuestionLine(value: string) {
  return /^\d+[.)]\s+/.test(value.trim());
}

function TopicGuide({ text }: { text: string }) {
  const lines = normalizeGuideText(text)
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim());

  if (lines.length === 0) {
    return null;
  }

  return (
    <div className="kr-keep mt-3 max-w-3xl rounded-lg border border-paper-surface/20 bg-paper-surface/10 px-4 py-3 text-[13px] leading-6 text-paper-surface shadow-sm">
      {lines.map((line, index) => {
        const trimmed = line.trim();
        const isHeading = isGuideHeading(trimmed);
        const isQuestion = isGuideQuestionLine(trimmed);

        return (
          <p
            className={cx(
              index > 0 && (isHeading ? "mt-2" : "mt-1"),
              isHeading ? "font-semibold opacity-100" : "opacity-90",
              isQuestion && "pl-4 -indent-4",
            )}
            key={`${trimmed}-${index}`}
          >
            {trimmed}
          </p>
        );
      })}
    </div>
  );
}

function formatTopicDate(createdAt?: string) {
  if (!createdAt) {
    return "오늘";
  }

  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    return "오늘";
  }

  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

function formatSubmissionDate(createdAt: string) {
  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    return "제출일 정보 없음";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getSubmissionTopicId(submission: SubmissionItem) {
  return submission.topic?.id ?? submission.topicId ?? null;
}

function getPhotoText(submission: SubmissionItem) {
  return (
    submission.editedExtractedText?.trim() ||
    submission.ocrExtractedText?.trim() ||
    submission.extractedText?.trim() ||
    ""
  );
}

function SubmissionNotebookView({
  message,
  photoImageLoadError,
  photoImageSrc,
  submission,
  topic,
  userName,
}: {
  message: string;
  photoImageLoadError?: boolean;
  photoImageSrc?: string;
  submission: SubmissionItem;
  topic?: Topic;
  userName?: string;
}) {
  const submittedAt = formatSubmissionDate(submission.createdAt);
  const hasFeedback = Boolean(submission.finalFeedback?.trim());
  const photoText = getPhotoText(submission);
  const feedbackText = submission.finalFeedback || "선생님이 글을 확인하고 있어요.";
  const feedbackBlock = (
    <div className="mt-[38px] border-t border-feedback-pen/25 pt-[19px]">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-feedback-pen">
        선생님이 남긴 말
      </p>
      <p className="ui-v2-teacher-feedback-note mt-2 whitespace-pre-line text-feedback-pen">
        {feedbackText}
      </p>
    </div>
  );

  return (
    <div className="space-y-5">
      {message ? (
        <NoticeBanner
          tone="success"
          title="공책 제출 완료"
          description={message}
        />
      ) : null}

      <section className="overflow-hidden rounded-md border border-ink-100 bg-paper-soft shadow-[0_1px_2px_rgba(60,40,20,.06),0_12px_28px_rgba(60,40,20,.06)]">
        <div className="flex flex-col gap-2 border-b-2 border-[#D9926A]/25 px-8 py-4 sm:flex-row sm:items-baseline sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-ink-700">
              {submittedAt} · {userName ?? "학생"}
            </p>
            <h2 className="mt-1 text-xl font-bold text-ink-900">
              {topic?.title ?? submission.topic?.title ?? "내가 쓴 글"}
            </h2>
          </div>
          <Badge tone={hasFeedback ? "feedback" : "teacher"}>
            {hasFeedback ? "피드백 도착" : "피드백 대기"}
          </Badge>
        </div>

        <div className="p-5 sm:p-7">
          {submission.inputType === "TYPED" ? (
            <NotebookPaper>
              <NotebookText>{submission.content || "제출된 글 내용이 없습니다."}</NotebookText>
              {feedbackBlock}
            </NotebookPaper>
          ) : (
            <div className="space-y-4 rounded-xl border border-ink-100 bg-paper-surface p-4">
              {submission.imageUrl ? (
                photoImageSrc ? (
                  <img
                    src={photoImageSrc}
                    alt="내가 제출한 공책 사진"
                    className="max-h-[560px] w-full rounded-lg object-contain"
                  />
                ) : (
                  <div className="rounded-lg border border-dashed border-ink-200 bg-paper-base/60 px-5 py-12 text-center text-sm text-ink-500">
                    {photoImageLoadError
                      ? "이미지를 불러오지 못했습니다. 접근 권한을 다시 확인해 주세요."
                      : "이미지를 불러오는 중입니다..."}
                  </div>
                )
              ) : (
                <div className="rounded-lg border border-dashed border-ink-200 bg-paper-base/60 px-5 py-12 text-center text-sm text-ink-500">
                  제출한 사진 정보를 불러오지 못했습니다.
                </div>
              )}
              {photoText ? (
                <NotebookPaper>
                  <NotebookText>{photoText}</NotebookText>
                  {feedbackBlock}
                </NotebookPaper>
              ) : (
                <NotebookPaper>
                  {feedbackBlock}
                </NotebookPaper>
              )}
            </div>
          )}
        </div>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-5 text-ink-500">
          이 주제는 이미 제출했어요. 선생님 피드백이 도착하면 이 화면에서 함께 볼 수 있습니다.
        </p>
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-student-accent px-[18px] py-[13px] text-[15px] font-semibold text-paper-surface shadow-[0_1px_0_rgba(120,60,30,.15),0_2px_6px_rgba(180,90,50,.18)] hover:bg-student-accent/90"
          href="/student"
        >
          내 책장으로 돌아가기
        </Link>
      </div>
    </div>
  );
}

function StudentUploadContent() {
  const searchParams = useSearchParams();
  const requestedTopicId = searchParams.get("topicId");
  const { token, user, isReady } = useAuth();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  const [topicId, setTopicId] = useState("");
  const [activeType, setActiveType] = useState<SubmissionInputType>("TYPED");
  const [content, setContent] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      return;
    }

    let ignore = false;
    const gradeQuery = user?.grade ? `?grade=${user.grade}` : "";

    async function loadWritingContext() {
      setIsLoading(true);
      setError("");

      try {
        const [nextTopics, nextSubmissions] = await Promise.all([
          apiFetch<Topic[]>(`/api/topics${gradeQuery}`, { token }),
          apiFetch<SubmissionItem[]>("/api/submissions", { token }),
        ]);

        if (ignore) {
          return;
        }

        setTopics(nextTopics);
        setSubmissions(nextSubmissions);
        setTopicId((currentTopicId) => {
          if (requestedTopicId && nextTopics.some((topic) => String(topic.id) === requestedTopicId)) {
            return requestedTopicId;
          }

          if (currentTopicId && nextTopics.some((topic) => String(topic.id) === currentTopicId)) {
            return currentTopicId;
          }

          return nextTopics[0] ? String(nextTopics[0].id) : "";
        });
      } catch (loadError) {
        if (!ignore) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "주제를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
          );
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void loadWritingContext();

    return () => {
      ignore = true;
    };
  }, [requestedTopicId, token, user?.grade]);

  const selectedTopic = useMemo(
    () => topics.find((topic) => String(topic.id) === topicId),
    [topicId, topics],
  );

  const latestSubmissionByTopicId = useMemo(() => {
    const submissionMap = new Map<number, SubmissionItem>();

    for (const submission of submissions) {
      const submissionTopicId = getSubmissionTopicId(submission);

      if (submissionTopicId && !submissionMap.has(submissionTopicId)) {
        submissionMap.set(submissionTopicId, submission);
      }
    }

    return submissionMap;
  }, [submissions]);

  const selectedSubmission = topicId ? latestSubmissionByTopicId.get(Number(topicId)) : undefined;
  const selectedPhotoImagePath =
    selectedSubmission?.inputType === "PHOTO" ? selectedSubmission.imageUrl : null;
  const [selectedPhotoObjectUrl, setSelectedPhotoObjectUrl] = useState("");
  const [selectedPhotoLoadError, setSelectedPhotoLoadError] = useState(false);

  useEffect(() => {
    if (!token || !selectedPhotoImagePath) {
      setSelectedPhotoObjectUrl("");
      setSelectedPhotoLoadError(false);
      return;
    }

    let ignore = false;
    let objectUrl = "";
    setSelectedPhotoObjectUrl("");
    setSelectedPhotoLoadError(false);

    apiFetchBlob(selectedPhotoImagePath, { token })
      .then((blob) => {
        if (ignore) {
          return;
        }

        objectUrl = URL.createObjectURL(blob);
        setSelectedPhotoObjectUrl(objectUrl);
      })
      .catch(() => {
        if (!ignore) {
          setSelectedPhotoObjectUrl("");
          setSelectedPhotoLoadError(true);
        }
      });

    return () => {
      ignore = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [selectedPhotoImagePath, token]);

  function buildSubmittedView(
    createdSubmission: SubmissionItem,
    fallback: Pick<SubmissionItem, "inputType" | "content" | "imageUrl">,
  ): SubmissionItem {
    return {
      ...createdSubmission,
      inputType: createdSubmission.inputType ?? fallback.inputType,
      content: createdSubmission.content ?? fallback.content,
      imageUrl: createdSubmission.imageUrl ?? fallback.imageUrl,
      status: createdSubmission.status ?? "PENDING",
      finalFeedback: createdSubmission.finalFeedback ?? null,
      createdAt: createdSubmission.createdAt ?? new Date().toISOString(),
      topicId: Number(topicId),
      topic: {
        id: Number(topicId),
        title: selectedTopic?.title,
        grade: selectedTopic?.grade,
      },
    };
  }

  async function handleTypedSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!topicId) {
      setError("주제를 먼저 선택해 주세요.");
      return;
    }

    if (selectedSubmission) {
      setError("이미 제출한 주제입니다. 저장된 공책을 확인해 주세요.");
      return;
    }

    const trimmedContent = content.trim();

    if (!trimmedContent) {
      setError("제출할 글 내용을 입력해 주세요.");
      return;
    }

    try {
      const createdSubmission = await apiFetch<SubmissionItem>("/api/submissions", {
        method: "POST",
        token,
        body: JSON.stringify({
          topicId: Number(topicId),
          inputType: "TYPED",
          content: trimmedContent,
        }),
      });
      const nextSubmission = buildSubmittedView(createdSubmission, {
        inputType: "TYPED",
        content: trimmedContent,
        imageUrl: null,
      });

      setSubmissions((current) => [
        nextSubmission,
        ...current.filter((submission) => getSubmissionTopicId(submission) !== Number(topicId)),
      ]);
      setContent("");
      setMessage("쓴 글이 선생님께 전해졌어요. 책장에서 같은 주제를 열면 제출한 공책을 볼 수 있습니다.");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "글쓰기 제출에 실패했습니다. 내용을 다시 확인해 주세요.",
      );
    }
  }

  async function handlePhotoSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!image || !topicId) {
      setError("주제와 사진을 모두 선택해 주세요.");
      return;
    }

    if (selectedSubmission) {
      setError("이미 제출한 주제입니다. 저장된 공책을 확인해 주세요.");
      return;
    }

    const formData = new FormData();
    formData.append("topicId", topicId);
    formData.append("inputType", "PHOTO");
    formData.append("image", image);

    try {
      const createdSubmission = await apiFetch<SubmissionItem>("/api/submissions", {
        method: "POST",
        token,
        body: formData,
      });
      const nextSubmission = buildSubmittedView(createdSubmission, {
        inputType: "PHOTO",
        content: null,
        imageUrl: createdSubmission.imageUrl,
      });

      setSubmissions((current) => [
        nextSubmission,
        ...current.filter((submission) => getSubmissionTopicId(submission) !== Number(topicId)),
      ]);
      setImage(null);
      setMessage("공책 사진이 선생님께 전해졌어요. 사진 속 글을 읽어 선생님이 확인할 수 있게 준비할게요.");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "사진 업로드에 실패했습니다. 파일 형식과 연결 상태를 다시 확인해 주세요.",
      );
    }
  }

  function handleTypeChange(nextType: SubmissionInputType) {
    setActiveType(nextType);
    setMessage("");
    setError("");
  }

  if (isReady && user?.role !== "STUDENT") {
    return (
      <section className="rounded-xl border border-ink-100 bg-paper-surface p-6 text-ink-700 shadow-sm">
        학생 계정만 접근할 수 있습니다.
      </section>
    );
  }

  const estimatedMinutes = Math.max(1, Math.ceil(content.length / 250));
  const topicDate = formatTopicDate(selectedTopic?.createdAt);
  const statusBadgeLabel = selectedSubmission
    ? selectedSubmission.finalFeedback
      ? "피드백 도착"
      : "제출 완료"
    : activeType === "TYPED"
      ? "직접 입력"
      : "공책 사진";

  return (
    <div className="overflow-hidden rounded-[28px] border border-ink-100 bg-paper-soft shadow-[0_1px_2px_rgba(60,40,20,.06),0_14px_34px_rgba(60,40,20,.08)]">
      <section className="bg-student-accent px-8 pb-7 pt-6 text-paper-surface">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <Link
              className="inline-flex min-h-8 items-center whitespace-nowrap rounded-md bg-paper-surface/15 px-3 text-xs font-semibold text-paper-surface hover:bg-paper-surface/25"
              href="/student"
            >
              ← 내 책장
            </Link>
            <div className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-2">
              <p className="text-sm font-semibold opacity-85">{topicDate}</p>
              <h1 className="text-[28px] font-bold leading-tight">
                {selectedTopic?.title ?? "글쓰기 주제를 고르는 중입니다"}
              </h1>
            </div>
            <p
              className={cx(
                "mt-3 max-w-3xl text-sm leading-6 opacity-90",
                selectedTopic?.description && !selectedSubmission && "hidden",
              )}
            >
              {selectedSubmission
                ? "이미 제출한 주제입니다. 내가 쓴 공책과 선생님 피드백을 한 화면에서 확인합니다."
                : selectedTopic?.description ||
                  "책장에서 고른 주제로 바로 글을 쓰거나, 공책에 쓴 글을 사진으로 올릴 수 있습니다."}
            </p>
            {!selectedSubmission && selectedTopic?.description ? (
              <TopicGuide text={selectedTopic.description} />
            ) : null}
          </div>

          <div className="flex flex-col items-start gap-2 xl:items-end">
            <Badge className="border-paper-surface/30 bg-paper-surface/20 text-paper-surface" tone="neutral">
              {statusBadgeLabel}
            </Badge>
            <p className="text-xs opacity-80">
              {user?.grade ? `${user.grade}학년 주제` : "공책톡톡"} · {user?.name ?? "학생"}
            </p>
          </div>
        </div>
      </section>

      <section className="px-6 py-8 xl:px-10">
        <div className="mx-auto flex w-full max-w-[820px] flex-col gap-5">
          {isLoading ? (
            <div className="rounded-xl border border-dashed border-ink-200 bg-paper-surface px-6 py-12 text-center text-sm text-ink-500">
              글쓰기 주제를 불러오는 중입니다...
            </div>
          ) : null}

          <div className="flex flex-col gap-4 rounded-lg border border-ink-100 bg-paper-surface px-4 py-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
            {selectedSubmission ? (
              <div>
                <p className="text-sm font-semibold text-ink-900">내가 제출한 공책 보기</p>
                <p className="mt-1 text-xs leading-5 text-ink-500">
                  새 글쓰기 입력창 대신 저장된 원문을 보여줍니다.
                </p>
              </div>
            ) : (
              <div className="inline-flex w-fit rounded-md bg-paper-base p-1">
                {(
                  [
                    { id: "TYPED", label: "직접 입력", icon: "Aa" },
                    { id: "PHOTO", label: "공책 사진", icon: "톡" },
                  ] satisfies Array<{ id: SubmissionInputType; label: string; icon: string }>
                ).map((type) => {
                  const isActive = activeType === type.id;

                  return (
                    <button
                      key={type.id}
                      className={cx(
                        "inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded-md px-4 py-2 text-sm font-semibold shadow-none",
                        isActive
                          ? "bg-paper-surface text-ink-900"
                          : "bg-transparent text-ink-500 hover:bg-paper-surface/70 hover:text-ink-900",
                      )}
                      type="button"
                      onClick={() => handleTypeChange(type.id)}
                    >
                      <span className="text-xs">{type.icon}</span>
                      {type.label}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 text-xs text-ink-500">
              {selectedSubmission ? (
                <span>{selectedSubmission.finalFeedback ? "선생님 피드백을 확인할 수 있어요." : "선생님 피드백을 기다리고 있어요."}</span>
              ) : activeType === "TYPED" ? (
                <span className="tabular-nums">
                  <strong className="text-ink-900">{content.length}</strong>자 · 약{" "}
                  <strong className="text-ink-900">{estimatedMinutes}</strong>분
                </span>
              ) : (
                <span className="max-w-[320px] truncate">
                  {image ? image.name : "공책 사진을 선택해 제출할 수 있습니다"}
                </span>
              )}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-ink-700" htmlFor="topicId">
              오늘 쓸 주제
            </label>
            <select
              className="h-11 rounded-md border-ink-100 bg-paper-surface text-sm text-ink-900 focus:border-student-accent focus:ring-student-accent/20"
              id="topicId"
              value={topicId}
              onChange={(event) => {
                setTopicId(event.target.value);
                setMessage("");
                setError("");
              }}
            >
              {topics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.title} ({topic.grade}학년)
                </option>
              ))}
            </select>
          </div>

          {selectedSubmission ? (
            <SubmissionNotebookView
              message={message}
              photoImageLoadError={selectedPhotoLoadError}
              photoImageSrc={selectedPhotoObjectUrl}
              submission={selectedSubmission}
              topic={selectedTopic}
              userName={user?.name}
            />
          ) : activeType === "TYPED" ? (
            <form className="space-y-5" onSubmit={handleTypedSubmit}>
              <div className="overflow-hidden rounded-md border border-ink-100 bg-paper-soft shadow-[0_1px_2px_rgba(60,40,20,.06),0_12px_28px_rgba(60,40,20,.06)]">
                <div className="flex items-baseline justify-between gap-4 border-b-2 border-[#D9926A]/25 px-8 py-4">
                  <p className="text-sm font-semibold text-ink-700">
                    {topicDate} · {user?.name ?? "학생"}
                  </p>
                  <p className="text-xs text-ink-300">공책에 쓰듯 천천히 적어 보세요</p>
                </div>
                <div className="p-5 sm:p-7">
                  <NotebookTextArea
                    maxLength={typedMaxLength}
                    rows={12}
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    placeholder="여기에 글을 써 보세요. 공책에 쓰듯 한 문장씩 천천히 채워도 괜찮아요."
                  />
                </div>
              </div>

              <div className="flex justify-end text-xs text-ink-500">
                <span className="tabular-nums">
                  {content.length} / {typedMaxLength}자
                </span>
              </div>

              {error ? <NoticeBanner tone="error" title="글쓰기 제출 실패" description={error} /> : null}

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Link
                  className="inline-flex min-h-11 items-center justify-center rounded-md px-[18px] py-[13px] text-[15px] font-semibold text-ink-700 hover:bg-paper-surface/70"
                  href="/student"
                >
                  ← 내 책장
                </Link>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <span className="text-xs text-ink-500">한 번 제출하면 다시 고치기 어려워요.</span>
                  <PrimaryButton type="submit">쓴 글 제출하기 →</PrimaryButton>
                </div>
              </div>
            </form>
          ) : (
            <form className="space-y-5" onSubmit={handlePhotoSubmit}>
              <div className="rounded-md border border-ink-100 bg-paper-surface p-6 shadow-[0_1px_2px_rgba(60,40,20,.06),0_12px_28px_rgba(60,40,20,.06)]">
                <div className="rounded-lg border border-dashed border-ink-200 bg-paper-base/70 px-6 py-12 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-student-accent/15 text-lg font-bold text-student-accent">
                    ▣
                  </div>
                  <label className="mt-5 block text-base font-semibold text-ink-900" htmlFor="writingPhoto">
                    공책 사진 올리기
                  </label>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink-700">
                    손글씨도 괜찮아요. 공책에 쓴 글이 선명하게 보이면 사진 속 글을 읽어 선생님이 확인할 수 있어요.
                  </p>
                  <input
                    className="mx-auto mt-5 max-w-md rounded-md border-ink-100 bg-paper-surface text-sm text-ink-700 file:mr-4 file:rounded-md file:border-0 file:bg-student-accent file:px-4 file:py-2 file:text-sm file:font-semibold file:text-paper-surface hover:file:bg-student-accent/90"
                    id="writingPhoto"
                    type="file"
                    accept="image/*"
                    onChange={(event) => setImage(event.target.files?.[0] || null)}
                  />
                  {image ? <p className="mt-3 text-xs text-ink-500">{image.name}</p> : null}
                </div>
              </div>

              {error ? <NoticeBanner tone="error" title="사진 제출 실패" description={error} /> : null}

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Link
                  className="inline-flex min-h-11 items-center justify-center rounded-md px-[18px] py-[13px] text-[15px] font-semibold text-ink-700 hover:bg-paper-surface/70"
                  href="/student"
                >
                  ← 내 책장
                </Link>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <span className="text-xs text-ink-500">사진 속 글이 잘 보이는지 확인해 주세요.</span>
                  <PrimaryButton type="submit">공책 사진 제출하기 →</PrimaryButton>
                </div>
              </div>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}

export default function StudentUploadPage() {
  return (
    <Suspense
      fallback={
        <section className="rounded-xl border border-ink-100 bg-paper-surface p-6 text-ink-700 shadow-sm">
          불러오는 중...
        </section>
      }
    >
      <StudentUploadContent />
    </Suspense>
  );
}
