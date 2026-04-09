"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { NoticeBanner } from "../../../../components/notice-banner";
import { StatusPill } from "../../../../components/status-pill";
import { useAuth } from "../../../../components/auth-provider";
import { API_BASE_URL, apiFetch } from "../../../../lib/api";

type SubmissionDetail = {
  id: number;
  inputType: "TYPED" | "PHOTO";
  imageUrl: string | null;
  content: string | null;
  extractedText: string | null;
  finalFeedback: string | null;
  status: "PENDING" | "REVIEWED";
  ocrStatus: "NONE" | "PROCESSING" | "DONE" | "FAILED";
  ocrError: string | null;
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
      return "OCR processing";
    case "DONE":
      return "OCR complete";
    case "FAILED":
      return "OCR failed";
    default:
      return "Waiting to start OCR";
  }
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
      setEditableExtractedText(data.extractedText || "");
      setFinalFeedback(data.finalFeedback || "");
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load submission.");
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
      editableExtractedText !== (submission.extractedText || "")
    ) {
      setDraftMessage("");
      setDraftError("Save the edited extracted text before generating an AI draft.");
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
      setDraftMessage("AI draft loaded into the feedback box. Review it before saving.");
    } catch (generateError) {
      setDraftError(
        generateError instanceof Error ? generateError.message : "Failed to generate AI feedback draft.",
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
      const updatedSubmission = await apiFetch<{ extractedText: string | null }>(
        `/api/submissions/${params.id}/extracted-text`,
        {
          method: "PATCH",
          token,
          body: JSON.stringify({ extractedText: editableExtractedText }),
        },
      );

      const nextExtractedText = updatedSubmission.extractedText || "";

      setSubmission((current) =>
        current
          ? {
              ...current,
              extractedText: nextExtractedText,
            }
          : current,
      );
      setEditableExtractedText(nextExtractedText);
      setExtractedTextMessage("Extracted text saved.");
    } catch (saveError) {
      setExtractedTextError(
        saveError instanceof Error ? saveError.message : "Failed to save extracted text.",
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
      setError(submitError instanceof Error ? submitError.message : "Failed to save feedback.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isReady && user?.role !== "TEACHER") {
    return <p className="rounded-xl bg-white p-6 shadow-sm">Teacher access only.</p>;
  }

  if (!submission) {
    return <p className="rounded-xl bg-white p-6 shadow-sm">Loading submission...</p>;
  }

  const canEditExtractedText = submission.inputType === "PHOTO" && submission.ocrStatus === "DONE";
  const hasUnsavedExtractedTextChanges =
    submission.inputType === "PHOTO" &&
    editableExtractedText !== (submission.extractedText || "");
  const canGenerateDraft =
    submission.inputType === "TYPED" ||
    (submission.inputType === "PHOTO" &&
      submission.ocrStatus === "DONE" &&
      Boolean(submission.extractedText?.trim()) &&
      !hasUnsavedExtractedTextChanges);
  const draftUnavailableDescription =
    submission.inputType === "PHOTO" && hasUnsavedExtractedTextChanges
      ? "Save the edited extracted text before generating an AI draft."
      : submission.inputType === "PHOTO" &&
          submission.ocrStatus === "DONE" &&
          !submission.extractedText?.trim()
        ? "Add and save extracted text before generating an AI draft."
        : "Photo submissions can generate a draft only after OCR completes.";

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link className="text-sm font-medium text-slate-500 hover:text-slate-900" href="/teacher/submissions">
              Back to submissions
            </Link>
            <h1 className="mt-2 text-xl font-semibold">{submission.topic.title}</h1>
          </div>
          <StatusPill status={submission.status} />
        </div>

        <p className="mt-2 text-sm leading-6 text-slate-600">{submission.topic.description || "No description"}</p>
        <p className="mt-2 text-sm text-slate-500">
          {submission.student.name} / Grade {submission.student.grade ?? "-"} /{" "}
          {submission.inputType === "TYPED" ? "Typed submission" : "Photo submission"}
        </p>

        {submission.inputType === "TYPED" ? (
          <div className="mt-4 rounded-2xl bg-slate-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Submission</p>
            <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-700">
              {submission.content || "No submission text."}
            </p>
          </div>
        ) : (
          <img
            src={`${API_BASE_URL}${submission.imageUrl}`}
            alt="Student submission"
            className="mt-4 max-h-[420px] w-full rounded-2xl border border-slate-200 object-contain"
          />
        )}

        {submission.inputType === "PHOTO" ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold">OCR Status</p>
            <p className="mt-1 text-sm text-slate-600">{getOcrStatusLabel(submission.ocrStatus)}</p>
            {submission.ocrError ? <p className="mt-2 text-sm text-red-600">{submission.ocrError}</p> : null}
          </div>
        ) : null}

        {submission.inputType === "PHOTO" ? (
          <div className="mt-4 rounded-2xl bg-slate-50 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Extracted Text
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Review and edit the OCR text before generating an AI draft.
                </p>
              </div>
              <button
                type="button"
                onClick={handleSaveExtractedText}
                disabled={!canEditExtractedText || isSavingExtractedText}
              >
                {isSavingExtractedText ? "Saving..." : "Save Extracted Text"}
              </button>
            </div>

            <textarea
              className="mt-4"
              rows={8}
              value={editableExtractedText}
              onChange={(event) => {
                setEditableExtractedText(event.target.value);
                setExtractedTextMessage("");
                setExtractedTextError("");
              }}
              placeholder="OCR text will appear here after processing."
              disabled={!canEditExtractedText}
            />

            {!canEditExtractedText ? (
              <p className="mt-2 text-sm text-slate-500">
                Extracted text can be edited after OCR completes.
              </p>
            ) : null}

            {extractedTextMessage ? (
              <div className="mt-4">
                <NoticeBanner tone="success" title="Extracted text saved" description={extractedTextMessage} />
              </div>
            ) : null}

            {extractedTextError ? (
              <div className="mt-4">
                <NoticeBanner tone="error" title="Save failed" description={extractedTextError} />
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Teacher Feedback</h2>
            <p className="mt-2 text-sm text-slate-600">
              AI drafts are optional. Review the generated text before saving final feedback.
            </p>
          </div>
          <button type="button" onClick={handleGenerateDraft} disabled={!canGenerateDraft || isGeneratingDraft}>
            {isGeneratingDraft ? "Generating draft..." : "Generate AI Draft"}
          </button>
        </div>

        {!canGenerateDraft ? (
          <div className="mt-4">
            <NoticeBanner
              tone="error"
              title="AI draft unavailable"
              description={draftUnavailableDescription}
            />
          </div>
        ) : null}

        {draftMessage ? (
          <div className="mt-4">
            <NoticeBanner tone="success" title="AI draft ready" description={draftMessage} />
          </div>
        ) : null}

        {draftError ? (
          <div className="mt-4">
            <NoticeBanner tone="error" title="AI draft failed" description={draftError} />
          </div>
        ) : null}

        <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
          <textarea
            rows={10}
            value={finalFeedback}
            onChange={(event) => setFinalFeedback(event.target.value)}
            placeholder="Enter final feedback for the student."
          />

          {error ? <NoticeBanner tone="error" title="Save failed" description={error} /> : null}

          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Feedback"}
            </button>
            <Link
              className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
              href="/teacher/submissions"
            >
              Back to list
            </Link>
          </div>
        </form>
      </section>
    </div>
  );
}
