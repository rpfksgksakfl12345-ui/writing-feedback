"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { NoticeBanner } from "../../../components/notice-banner";
import { useAuth } from "../../../components/auth-provider";
import { Badge, NotebookPaper, NotebookText, NotebookTextArea, PrimaryButton } from "../../../components/ui-v2";
import { API_BASE_URL, apiFetch } from "../../../lib/api";

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
  submission,
  topic,
  userName,
}: {
  message: string;
  submission: SubmissionItem;
  topic?: Topic;
  userName?: string;
}) {
  const submittedAt = formatSubmissionDate(submission.createdAt);
  const hasFeedback = Boolean(submission.finalFeedback?.trim());
  const photoText = getPhotoText(submission);
  const feedbackText = submission.finalFeedback || "선생님이 아직 피드백을 작성 중이에요.";
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
          title="글쓰기 저장 완료"
          description={message}
        />
      ) : null}

      <section className="overflow-hidden rounded-md border border-[#E8DEC7] bg-[#FBF6E9] shadow-[0_1px_2px_rgba(60,40,20,.06),0_12px_28px_rgba(60,40,20,.06)]">
        <div className="flex flex-col gap-2 border-b-2 border-[#D9926A]/25 px-8 py-4 sm:flex-row sm:items-baseline sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#5A5247]">
              {submittedAt} · {userName ?? "학생"}
            </p>
            <h2 className="mt-1 text-xl font-bold text-[#2E2A24]">
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
            <div className="space-y-4 rounded-xl border border-[#E8DEC7] bg-[#FFFAF0] p-4">
              {submission.imageUrl ? (
                <img
                  src={`${API_BASE_URL}${submission.imageUrl}`}
                  alt="내가 제출한 공책 사진"
                  className="max-h-[560px] w-full rounded-lg object-contain"
                />
              ) : (
                <div className="rounded-lg border border-dashed border-[#C9B998] bg-paper-base/60 px-5 py-12 text-center text-sm text-[#8B8170]">
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
        <p className="text-xs leading-5 text-[#8B8170]">
          이 주제는 이미 제출되어 새 입력창 대신 저장된 공책을 보여줍니다.
        </p>
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-student-accent px-[18px] py-[13px] text-[15px] font-semibold text-[#FFFAF0] shadow-[0_1px_0_rgba(120,60,30,.15),0_2px_6px_rgba(180,90,50,.18)] hover:bg-student-accent/90"
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
      setMessage("제출이 저장되었습니다. 이제 책장에서 같은 주제를 열면 이 공책을 볼 수 있어요.");
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
      setMessage("사진 제출이 저장되었습니다. 이제 책장에서 같은 주제를 열면 제출한 공책을 볼 수 있어요.");
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
      <section className="rounded-xl border border-[#E8DEC7] bg-[#FFFAF0] p-6 text-[#5A5247] shadow-sm">
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
      ? "직접 쓰기"
      : "사진 제출";

  return (
    <div className="overflow-hidden rounded-[28px] border border-[#E8DEC7] bg-paper-base shadow-sm">
      <section className="bg-student-accent px-8 pb-7 pt-6 text-[#FFFAF0]">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <Link
              className="inline-flex min-h-8 items-center whitespace-nowrap rounded-md bg-[#FFFAF0]/15 px-3 text-xs font-semibold text-[#FFFAF0] hover:bg-[#FFFAF0]/25"
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
            <p className="mt-3 max-w-3xl text-sm leading-6 opacity-90">
              {selectedSubmission
                ? "이미 제출한 주제입니다. 내가 쓴 공책과 선생님 피드백을 한 화면에서 확인합니다."
                : selectedTopic?.description ||
                  "책장에서 고른 주제로 바로 글을 쓰거나, 공책에 쓴 글을 사진으로 제출할 수 있습니다."}
            </p>
          </div>

          <div className="flex flex-col items-start gap-2 xl:items-end">
            <Badge className="border-[#FFFAF0]/30 bg-[#FFFAF0]/20 text-[#FFFAF0]" tone="neutral">
              {statusBadgeLabel}
            </Badge>
            <p className="text-xs opacity-80">
              {user?.grade ? `${user.grade}학년 주제` : "학생 글쓰기"} · {user?.name ?? "학생"}
            </p>
          </div>
        </div>
      </section>

      <section className="px-6 py-8 xl:px-10">
        <div className="mx-auto flex w-full max-w-[820px] flex-col gap-5">
          {isLoading ? (
            <div className="rounded-xl border border-dashed border-[#C9B998] bg-[#FFFAF0] px-6 py-12 text-center text-sm text-[#8B8170]">
              글쓰기 주제를 불러오는 중입니다...
            </div>
          ) : null}

          <div className="flex flex-col gap-4 rounded-lg border border-[#E8DEC7] bg-[#FFFAF0] px-4 py-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
            {selectedSubmission ? (
              <div>
                <p className="text-sm font-semibold text-[#2E2A24]">내가 제출한 공책 보기</p>
                <p className="mt-1 text-xs leading-5 text-[#8B8170]">
                  새 글쓰기 입력창 대신 저장된 원문을 보여줍니다.
                </p>
              </div>
            ) : (
              <div className="inline-flex w-fit rounded-md bg-paper-base p-1">
                {(
                  [
                    { id: "TYPED", label: "직접 쓰기", icon: "Aa" },
                    { id: "PHOTO", label: "사진 제출", icon: "▣" },
                  ] satisfies Array<{ id: SubmissionInputType; label: string; icon: string }>
                ).map((type) => {
                  const isActive = activeType === type.id;

                  return (
                    <button
                      key={type.id}
                      className={cx(
                        "inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded-md px-4 py-2 text-sm font-semibold shadow-none",
                        isActive
                          ? "bg-[#FFFAF0] text-[#2E2A24]"
                          : "bg-transparent text-[#8B8170] hover:bg-[#FFFAF0]/70 hover:text-[#2E2A24]",
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

            <div className="flex flex-wrap items-center gap-3 text-xs text-[#8B8170]">
              {selectedSubmission ? (
                <span>{selectedSubmission.finalFeedback ? "선생님 피드백을 확인할 수 있어요." : "선생님 피드백을 기다리고 있어요."}</span>
              ) : activeType === "TYPED" ? (
                <span className="tabular-nums">
                  <strong className="text-[#2E2A24]">{content.length}</strong>자 · 약{" "}
                  <strong className="text-[#2E2A24]">{estimatedMinutes}</strong>분
                </span>
              ) : (
                <span className="max-w-[320px] truncate">
                  {image ? image.name : "사진 파일을 선택해 제출할 수 있습니다"}
                </span>
              )}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-[#5A5247]" htmlFor="topicId">
              주제 선택
            </label>
            <select
              className="h-11 rounded-md border-[#E8DEC7] bg-[#FFFAF0] text-sm text-[#2E2A24] focus:border-student-accent focus:ring-student-accent/20"
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
              submission={selectedSubmission}
              topic={selectedTopic}
              userName={user?.name}
            />
          ) : activeType === "TYPED" ? (
            <form className="space-y-5" onSubmit={handleTypedSubmit}>
              <div className="overflow-hidden rounded-md border border-[#E8DEC7] bg-[#FBF6E9] shadow-[0_1px_2px_rgba(60,40,20,.06),0_12px_28px_rgba(60,40,20,.06)]">
                <div className="flex items-baseline justify-between gap-4 border-b-2 border-[#D9926A]/25 px-8 py-4">
                  <p className="text-sm font-semibold text-[#5A5247]">
                    {topicDate} · {user?.name ?? "학생"}
                  </p>
                  <p className="text-xs text-[#A89C85]">생각을 천천히 적어 보세요</p>
                </div>
                <div className="p-5 sm:p-7">
                  <NotebookTextArea
                    maxLength={typedMaxLength}
                    rows={12}
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    placeholder="여기에 글을 써 보세요. 줄과 줄 사이에 천천히 생각을 채워 넣으면 됩니다."
                  />
                </div>
              </div>

              <div className="flex justify-end text-xs text-[#8B8170]">
                <span className="tabular-nums">
                  {content.length} / {typedMaxLength}자
                </span>
              </div>

              {error ? <NoticeBanner tone="error" title="글쓰기 제출 실패" description={error} /> : null}

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Link
                  className="inline-flex min-h-11 items-center justify-center rounded-md px-[18px] py-[13px] text-[15px] font-semibold text-[#5A5247] hover:bg-[#FFFAF0]/70"
                  href="/student"
                >
                  ← 내 책장
                </Link>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <span className="text-xs text-[#8B8170]">한 번 제출하면 다시 고치기 어려워요.</span>
                  <PrimaryButton type="submit">선생님께 제출하기 →</PrimaryButton>
                </div>
              </div>
            </form>
          ) : (
            <form className="space-y-5" onSubmit={handlePhotoSubmit}>
              <div className="rounded-md border border-[#E8DEC7] bg-[#FFFAF0] p-6 shadow-[0_1px_2px_rgba(60,40,20,.06),0_12px_28px_rgba(60,40,20,.06)]">
                <div className="rounded-lg border border-dashed border-[#C9B998] bg-paper-base/70 px-6 py-12 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-student-accent/15 text-lg font-bold text-student-accent">
                    ▣
                  </div>
                  <label className="mt-5 block text-base font-semibold text-[#2E2A24]" htmlFor="writingPhoto">
                    공책 사진 선택
                  </label>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#5A5247]">
                    공책에 쓴 글이 선명하게 보이는 사진을 올려 주세요. 기존 OCR 처리 흐름으로 제출됩니다.
                  </p>
                  <input
                    className="mx-auto mt-5 max-w-md rounded-md border-[#E8DEC7] bg-[#FFFAF0] text-sm text-[#5A5247] file:mr-4 file:rounded-md file:border-0 file:bg-student-accent file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[#FFFAF0] hover:file:bg-student-accent/90"
                    id="writingPhoto"
                    type="file"
                    accept="image/*"
                    onChange={(event) => setImage(event.target.files?.[0] || null)}
                  />
                  {image ? <p className="mt-3 text-xs text-[#8B8170]">{image.name}</p> : null}
                </div>
              </div>

              {error ? <NoticeBanner tone="error" title="사진 제출 실패" description={error} /> : null}

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Link
                  className="inline-flex min-h-11 items-center justify-center rounded-md px-[18px] py-[13px] text-[15px] font-semibold text-[#5A5247] hover:bg-[#FFFAF0]/70"
                  href="/student"
                >
                  ← 내 책장
                </Link>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <span className="text-xs text-[#8B8170]">사진 속 글이 잘 보이는지 확인해 주세요.</span>
                  <PrimaryButton type="submit">사진 업로드하기 →</PrimaryButton>
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
        <section className="rounded-xl border border-[#E8DEC7] bg-[#FFFAF0] p-6 text-[#5A5247] shadow-sm">
          불러오는 중...
        </section>
      }
    >
      <StudentUploadContent />
    </Suspense>
  );
}
