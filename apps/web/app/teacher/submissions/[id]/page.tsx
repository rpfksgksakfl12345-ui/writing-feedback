"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { NoticeBanner } from "../../../../components/notice-banner";
import { useAuth } from "../../../../components/auth-provider";
import { Badge, PrimaryButton, SecondaryButton } from "../../../../components/ui-v2";
import { API_BASE_URL, apiFetch } from "../../../../lib/api";

type SubmissionDetail = {
  id: number;
  inputType: "TYPED" | "PHOTO";
  imageUrl: string | null;
  content: string | null;
  ocrExtractedText: string | null;
  editedExtractedText: string | null;
  extractedText: string | null;
  finalFeedback: string | null;
  status: "PENDING" | "REVIEWED";
  ocrStatus: "NONE" | "PROCESSING" | "DONE" | "FAILED";
  ocrError: string | null;
  createdAt: string;
  student: { name: string; grade: number | null };
  topic: { title: string; description: string | null; grade: number };
};

type FeedbackDraftResult = {
  strengths: string[];
  improvements: string[];
  overall: string;
};

function getOcrStatusLabel(ocrStatus: SubmissionDetail["ocrStatus"]) {
  switch (ocrStatus) {
    case "PROCESSING":
      return "OCR 처리 중";
    case "DONE":
      return "OCR 완료";
    case "FAILED":
      return "OCR 실패";
    default:
      return "OCR 대기";
  }
}

function getSavedPhotoText(
  submission: Pick<SubmissionDetail, "editedExtractedText" | "ocrExtractedText" | "extractedText">,
) {
  return (
    submission.editedExtractedText?.trim() ||
    submission.ocrExtractedText?.trim() ||
    submission.extractedText?.trim() ||
    ""
  );
}

function getEditableExtractedText(
  submission: Pick<SubmissionDetail, "editedExtractedText" | "ocrExtractedText" | "extractedText">,
) {
  return submission.editedExtractedText || submission.extractedText || submission.ocrExtractedText || "";
}

function getInputTypeLabel(inputType: SubmissionDetail["inputType"]) {
  return inputType === "TYPED" ? "직접쓰기" : "사진제출";
}

function getSubmissionStatusMeta(status: SubmissionDetail["status"]) {
  if (status === "REVIEWED") {
    return {
      label: "피드백 완료",
      tone: "feedback" as const,
      description: "최종 피드백이 저장된 제출물입니다.",
    };
  }

  return {
    label: "피드백 대기",
    tone: "student" as const,
    description: "검토 후 최종 피드백 저장이 필요합니다.",
  };
}

function getOcrStatusTone(ocrStatus: SubmissionDetail["ocrStatus"]) {
  if (ocrStatus === "DONE") {
    return "success" as const;
  }

  if (ocrStatus === "FAILED") {
    return "student" as const;
  }

  return "neutral" as const;
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

export default function SubmissionDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { token, user, isReady } = useAuth();

  const [submission, setSubmission] = useState<SubmissionDetail | null>(null);
  const [editableExtractedText, setEditableExtractedText] = useState("");
  const [finalFeedback, setFinalFeedback] = useState("");
  const [error, setError] = useState("");
  const [draftError, setDraftError] = useState("");
  const [draftMessage, setDraftMessage] = useState("");
  const [extractedTextError, setExtractedTextError] = useState("");
  const [extractedTextMessage, setExtractedTextMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingExtractedText, setIsSavingExtractedText] = useState(false);
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);

  async function loadSubmission() {
    if (!token) {
      return;
    }

    try {
      const data = await apiFetch<SubmissionDetail>(`/api/submissions/${params.id}`, { token });
      setSubmission(data);
      setEditableExtractedText(getEditableExtractedText(data));
      setFinalFeedback(data.finalFeedback || "");
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "제출물을 불러오지 못했습니다.");
    }
  }

  useEffect(() => {
    void loadSubmission();
  }, [params.id, token]);

  useEffect(() => {
    if (!token || !submission || submission.inputType !== "PHOTO") {
      return;
    }

    if (submission.ocrStatus !== "NONE" && submission.ocrStatus !== "PROCESSING") {
      return;
    }

    const pollTimer = window.setInterval(() => {
      void loadSubmission();
    }, 2500);

    return () => window.clearInterval(pollTimer);
  }, [submission, token]);

  async function handleGenerateDraft() {
    if (!token || !submission || isGeneratingDraft) {
      return;
    }

    if (
      submission.inputType === "PHOTO" &&
      editableExtractedText !== getEditableExtractedText(submission)
    ) {
      setDraftMessage("");
      setDraftError("AI 초안을 생성하기 전에 수정한 텍스트를 먼저 저장해 주세요.");
      return;
    }

    setDraftError("");
    setDraftMessage("");
    setIsGeneratingDraft(true);

    try {
      const draft = await apiFetch<FeedbackDraftResult>(`/api/submissions/${params.id}/feedback-draft`, {
        method: "POST",
        token,
      });

      const nextFeedback = [
        "잘한 점",
        ...draft.strengths.map((item) => `- ${item}`),
        "",
        "보완하면 좋은 점",
        ...draft.improvements.map((item) => `- ${item}`),
        "",
        "총평",
        draft.overall,
      ].join("\n");

      setFinalFeedback(nextFeedback);
      setDraftMessage("AI 초안이 피드백 입력칸에 들어갔습니다. 저장 전 내용을 확인해 주세요.");
    } catch (generateError) {
      setDraftError(
        generateError instanceof Error ? generateError.message : "AI 피드백 초안 생성에 실패했습니다.",
      );
    } finally {
      setIsGeneratingDraft(false);
    }
  }

  async function handleSaveExtractedText() {
    if (
      !token ||
      !submission ||
      submission.inputType !== "PHOTO" ||
      submission.ocrStatus !== "DONE" ||
      isSavingExtractedText
    ) {
      return;
    }

    setExtractedTextError("");
    setExtractedTextMessage("");
    setIsSavingExtractedText(true);

    try {
      const updatedSubmission = await apiFetch<
        Pick<SubmissionDetail, "ocrExtractedText" | "editedExtractedText" | "extractedText">
      >(
        `/api/submissions/${params.id}/extracted-text`,
        {
          method: "PATCH",
          token,
          body: JSON.stringify({ extractedText: editableExtractedText }),
        },
      );

      const nextEditableExtractedText = getEditableExtractedText(updatedSubmission);

      setSubmission((current) =>
        current
          ? {
              ...current,
              ocrExtractedText: updatedSubmission.ocrExtractedText,
              editedExtractedText: updatedSubmission.editedExtractedText,
              extractedText: updatedSubmission.extractedText,
            }
          : current,
      );
      setEditableExtractedText(nextEditableExtractedText);
      setExtractedTextMessage("수정 텍스트를 저장했습니다.");
    } catch (saveError) {
      setExtractedTextError(
        saveError instanceof Error ? saveError.message : "수정 텍스트 저장에 실패했습니다.",
      );
    } finally {
      setIsSavingExtractedText(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSaving(true);

    try {
      await apiFetch(`/api/submissions/${params.id}/feedback`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ finalFeedback }),
      });
      router.push("/teacher/submissions?saved=1");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "피드백 저장에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isReady && user?.role !== "TEACHER") {
    return (
      <section className="rounded-xl border border-ink-100 bg-paper-surface p-6 text-ink-700 shadow-sm">
        교사 계정만 접근할 수 있습니다.
      </section>
    );
  }

  if (!submission) {
    return (
      <section className="rounded-xl border border-ink-100 bg-paper-surface p-6 text-ink-700 shadow-sm">
        제출물을 불러오는 중입니다...
      </section>
    );
  }

  const savedPhotoText = getSavedPhotoText(submission);
  const savedEditableExtractedText = getEditableExtractedText(submission);
  const originalOcrText = submission.ocrExtractedText?.trim() || "";
  const canEditExtractedText = submission.inputType === "PHOTO" && submission.ocrStatus === "DONE";
  const hasUnsavedExtractedTextChanges =
    submission.inputType === "PHOTO" && editableExtractedText !== savedEditableExtractedText;
  const canGenerateDraft =
    submission.inputType === "TYPED" ||
    (submission.inputType === "PHOTO" &&
      submission.ocrStatus === "DONE" &&
      Boolean(savedPhotoText) &&
      !hasUnsavedExtractedTextChanges);
  const draftUnavailableDescription =
    submission.inputType === "PHOTO" && hasUnsavedExtractedTextChanges
      ? "AI 초안을 생성하기 전에 수정 텍스트를 저장해 주세요."
      : submission.inputType === "PHOTO" && submission.ocrStatus === "DONE" && !savedPhotoText
        ? "AI 초안을 생성하기 전에 텍스트를 추가하고 저장해 주세요."
        : "사진 제출은 OCR이 완료된 뒤 AI 초안을 생성할 수 있습니다.";
  const statusMeta = getSubmissionStatusMeta(submission.status);
  const submittedAt = formatSubmissionDate(submission.createdAt);

  return (
    <div className="overflow-hidden rounded-[28px] border border-ink-100 bg-paper-soft shadow-[0_1px_2px_rgba(60,40,20,.06),0_14px_34px_rgba(60,40,20,.08)]">
      <section className="bg-paper-surface bg-[radial-gradient(rgba(90,110,133,.07)_1px,transparent_1px)] bg-[length:24px_24px] px-8 pb-7 pt-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <Link
              className="inline-flex min-h-9 items-center rounded-md border border-ink-100 bg-paper-surface px-3 text-sm font-semibold text-ink-700 hover:bg-paper-base"
              href="/teacher/submissions"
            >
              ← 제출물 목록
            </Link>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
              <Badge tone="teacher">{getInputTypeLabel(submission.inputType)}</Badge>
              {submission.inputType === "PHOTO" ? (
                <Badge tone={getOcrStatusTone(submission.ocrStatus)}>
                  {getOcrStatusLabel(submission.ocrStatus)}
                </Badge>
              ) : null}
            </div>
            <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight text-ink-900">
              {submission.topic.title}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-ink-700">
              {submission.topic.description || "주제 설명이 없습니다."}
            </p>
          </div>

          <div className="grid min-w-[280px] gap-3 rounded-xl border border-ink-100 bg-paper-surface/85 p-4 text-sm shadow-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-500">학생</p>
              <p className="mt-1 font-semibold text-ink-900">
                {submission.student.name} / {submission.student.grade ?? "-"}학년
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-ink-500">제출 시점</p>
                <p className="mt-1 font-semibold text-ink-900">{submittedAt}</p>
              </div>
              <div>
                <p className="text-xs text-ink-500">주제 학년</p>
                <p className="mt-1 font-semibold text-ink-900">{submission.topic.grade}학년</p>
              </div>
            </div>
            <p className="text-xs leading-5 text-ink-500">{statusMeta.description}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 px-8 pb-10 pt-7 xl:grid-cols-[minmax(0,1.15fr)_minmax(380px,.85fr)]">
        <div className="space-y-5">
          <section className="rounded-xl border border-ink-100 bg-paper-surface p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-500">
                  학생 제출물
                </p>
                <h2 className="mt-1 text-lg font-bold text-ink-900">
                  {submission.inputType === "TYPED" ? "직접 쓴 글 원문" : "사진 원본"}
                </h2>
              </div>
              <Badge tone="teacher">{getInputTypeLabel(submission.inputType)}</Badge>
            </div>

            {submission.inputType === "TYPED" ? (
              <div className="mt-5 rounded-lg border border-ink-100 bg-paper-soft px-5 py-5 shadow-[inset_0_1px_rgba(255,255,255,.55)]">
                <p className="max-h-[540px] overflow-auto whitespace-pre-line text-sm leading-7 text-ink-900">
                  {submission.content || "제출된 글 내용이 없습니다."}
                </p>
              </div>
            ) : (
              <div className="mt-5 rounded-lg border border-ink-100 bg-paper-base p-3 shadow-[inset_0_1px_rgba(255,255,255,.45)]">
                <img
                  src={`${API_BASE_URL}${submission.imageUrl}`}
                  alt="학생 제출 이미지"
                  className="max-h-[520px] w-full rounded-md object-contain"
                />
              </div>
            )}
          </section>

          {submission.inputType === "PHOTO" ? (
            <section className="rounded-xl border border-ink-100 bg-paper-surface p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-500">
                    OCR / 추출 텍스트
                  </p>
                  <h2 className="mt-1 text-lg font-bold text-ink-900">사진 글자 확인</h2>
                </div>
                <Badge tone={getOcrStatusTone(submission.ocrStatus)}>
                  {getOcrStatusLabel(submission.ocrStatus)}
                </Badge>
              </div>

              {submission.ocrError ? (
                <div className="mt-4">
                  <NoticeBanner tone="error" title="OCR 처리 오류" description={submission.ocrError} />
                </div>
              ) : null}

              <div className="mt-5 rounded-lg border border-ink-100 bg-paper-base/60 px-5 py-4 shadow-[inset_0_1px_rgba(255,255,255,.45)]">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-500">
                  OCR 원본
                </p>
                {originalOcrText ? (
                  <p className="mt-3 max-h-56 overflow-auto whitespace-pre-line text-sm leading-7 text-ink-900">
                    {submission.ocrExtractedText}
                  </p>
                ) : (
                  <p className="mt-3 text-sm text-ink-500">
                    아직 OCR 원본 텍스트가 없습니다.
                  </p>
                )}
              </div>

              <div className="mt-5 rounded-lg border border-ink-100 bg-paper-soft px-5 py-4 shadow-[inset_0_1px_rgba(255,255,255,.45)]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-500">
                      교사 수정 텍스트
                    </p>
                    <p className="mt-2 text-sm text-ink-700">
                      저장된 텍스트가 AI 피드백 초안 생성에 사용됩니다.
                    </p>
                  </div>
                  <SecondaryButton
                    type="button"
                    onClick={handleSaveExtractedText}
                    disabled={!canEditExtractedText || isSavingExtractedText}
                  >
                    {isSavingExtractedText ? "저장 중..." : "수정 텍스트 저장"}
                  </SecondaryButton>
                </div>

                <textarea
                  className="mt-4 min-h-[220px] rounded-md border-ink-100 bg-paper-surface text-sm leading-7 text-ink-900 focus:border-teacher-accent focus:ring-teacher-accent/20 disabled:bg-paper-base disabled:text-ink-500"
                  rows={8}
                  value={editableExtractedText}
                  onChange={(event) => {
                    setEditableExtractedText(event.target.value);
                    setExtractedTextMessage("");
                    setExtractedTextError("");
                  }}
                  placeholder="OCR 처리가 끝나면 추출 텍스트가 여기에 표시됩니다."
                  disabled={!canEditExtractedText}
                />

                {!canEditExtractedText ? (
                  <p className="mt-2 text-sm text-ink-500">
                    OCR이 완료된 뒤 수정 텍스트를 저장할 수 있습니다.
                  </p>
                ) : null}

                {extractedTextMessage ? (
                  <div className="mt-4">
                    <NoticeBanner tone="success" title="수정 텍스트 저장 완료" description={extractedTextMessage} />
                  </div>
                ) : null}

                {extractedTextError ? (
                  <div className="mt-4">
                    <NoticeBanner tone="error" title="수정 텍스트 저장 실패" description={extractedTextError} />
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}
        </div>

        <section className="h-fit rounded-xl border border-feedback-pen/25 bg-feedback-soft p-5 shadow-sm xl:sticky xl:top-6">
          <div className="mb-4 h-1.5 rounded-full bg-feedback-pen/70" />
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-feedback-pen">
                교사 피드백
              </p>
              <h2 className="mt-1 text-xl font-bold text-ink-900">최종 피드백 작성</h2>
              <p className="mt-2 text-sm leading-6 text-ink-700">
                AI 초안은 선택 사항입니다. 내용을 검토한 뒤 최종 피드백으로 저장하세요.
              </p>
            </div>
            <PrimaryButton
              tone="teacher"
              type="button"
              onClick={handleGenerateDraft}
              disabled={!canGenerateDraft || isGeneratingDraft}
            >
              {isGeneratingDraft ? "초안 생성 중..." : "AI 초안 생성"}
            </PrimaryButton>
          </div>

          {!canGenerateDraft ? (
            <div className="mt-4">
              <NoticeBanner
                tone="error"
                title="AI 초안 생성 불가"
                description={draftUnavailableDescription}
              />
            </div>
          ) : null}

          {draftMessage ? (
            <div className="mt-4">
              <NoticeBanner tone="success" title="AI 초안 준비 완료" description={draftMessage} />
            </div>
          ) : null}

          {draftError ? (
            <div className="mt-4">
              <NoticeBanner tone="error" title="AI 초안 생성 실패" description={draftError} />
            </div>
          ) : null}

          <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
            <textarea
              className="min-h-[360px] rounded-md border-feedback-pen/20 bg-paper-surface bg-[linear-gradient(transparent_31px,rgba(58,111,176,.12)_32px)] bg-[length:100%_32px] text-sm leading-7 text-feedback-pen placeholder:text-ink-500 focus:border-feedback-pen focus:ring-feedback-pen/20"
              rows={12}
              value={finalFeedback}
              onChange={(event) => setFinalFeedback(event.target.value)}
              placeholder="학생에게 보낼 최종 피드백을 입력하세요."
            />

            {error ? <NoticeBanner tone="error" title="피드백 저장 실패" description={error} /> : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Link
                className="inline-flex min-h-11 min-w-[150px] items-center justify-center whitespace-nowrap rounded-md border border-ink-100 bg-paper-surface px-[18px] py-[13px] text-[15px] font-semibold text-ink-900 hover:bg-paper-base"
                href="/teacher/submissions"
              >
                목록으로 돌아가기
              </Link>
              <PrimaryButton className="min-w-[150px] whitespace-nowrap" tone="teacher" type="submit" disabled={isSaving}>
                {isSaving ? "저장 중..." : "최종 피드백 저장"}
              </PrimaryButton>
            </div>
          </form>
        </section>
      </section>
    </div>
  );
}
