"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { NoticeBanner } from "../../../components/notice-banner";
import { useAuth } from "../../../components/auth-provider";
import { apiFetch } from "../../../lib/api";

type Topic = {
  id: number;
  title: string;
  grade: number;
};

type SubmissionInputType = "TYPED" | "PHOTO";

const typedMaxLength = 2000;

function StudentUploadContent() {
  const searchParams = useSearchParams();
  const { token, user, isReady } = useAuth();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [topicId, setTopicId] = useState("");
  const [activeType, setActiveType] = useState<SubmissionInputType>("TYPED");
  const [content, setContent] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      return;
    }

    const requestedTopicId = searchParams.get("topicId");
    const gradeQuery = user?.grade ? `?grade=${user.grade}` : "";

    apiFetch<Topic[]>(`/api/topics${gradeQuery}`, { token })
      .then((data) => {
        setTopics(data);

        const nextTopicId =
          requestedTopicId && data.some((topic) => String(topic.id) === requestedTopicId)
            ? requestedTopicId
            : data[0]
              ? String(data[0].id)
              : "";

        setTopicId(nextTopicId);
      })
      .catch((loadError) => {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "주제를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
        );
      });
  }, [searchParams, token, user?.grade]);

  async function handleTypedSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!topicId) {
      setError("주제를 먼저 선택해 주세요.");
      return;
    }

    if (!content.trim()) {
      setError("제출할 글 내용을 입력해 주세요.");
      return;
    }

    try {
      await apiFetch("/api/submissions", {
        method: "POST",
        token,
        body: JSON.stringify({
          topicId: Number(topicId),
          inputType: "TYPED",
          content: content.trim(),
        }),
      });
      setContent("");
      setMessage("글쓰기를 제출했습니다.");
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

    const formData = new FormData();
    formData.append("topicId", topicId);
    formData.append("inputType", "PHOTO");
    formData.append("image", image);

    try {
      await apiFetch("/api/submissions", {
        method: "POST",
        token,
        body: formData,
      });
      setImage(null);
      setMessage("사진 제출을 완료했습니다.");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "사진 업로드에 실패했습니다. 파일 형식과 연결 상태를 다시 확인해 주세요.",
      );
    }
  }

  if (isReady && user?.role !== "STUDENT") {
    return <p className="rounded-xl bg-white p-6 shadow-sm">학생 계정만 접근할 수 있습니다.</p>;
  }

  return (
    <section className="rounded-[32px] border border-[#eadfce] bg-[#fffdf8] p-6 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#4f3828]">글쓰기 제출</h1>
          <p className="mt-1 text-sm text-[#6b5645]">
            책장에서 고른 주제로 바로 제출할 수 있습니다. 기존 타자 입력과 사진 업로드 흐름은 그대로
            유지됩니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link className="font-medium text-[#7c5b3d] hover:text-[#5f4330]" href="/student">
            책장으로 돌아가기
          </Link>
          <Link className="font-medium text-slate-600 hover:text-slate-900" href="/student/history">
            제출 기록 보기
          </Link>
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-[#f7efe3] p-2">
        <div className="grid grid-cols-2 gap-2">
          <button
            className={activeType === "TYPED" ? "" : "bg-white text-slate-700 hover:bg-white"}
            type="button"
            onClick={() => {
              setActiveType("TYPED");
              setMessage("");
              setError("");
            }}
          >
            글로 입력하기
          </button>
          <button
            className={activeType === "PHOTO" ? "" : "bg-white text-slate-700 hover:bg-white"}
            type="button"
            onClick={() => {
              setActiveType("PHOTO");
              setMessage("");
              setError("");
            }}
          >
            사진 올리기
          </button>
        </div>
      </div>

      <div className="mt-4">
        <label className="mb-1 block text-sm font-medium text-[#5f4a3a]">주제 선택</label>
        <select value={topicId} onChange={(event) => setTopicId(event.target.value)}>
          {topics.map((topic) => (
            <option key={topic.id} value={topic.id}>
              {topic.title} ({topic.grade}학년)
            </option>
          ))}
        </select>
      </div>

      {activeType === "TYPED" ? (
        <form className="mt-4 space-y-4" onSubmit={handleTypedSubmit}>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#5f4a3a]">글쓰기 내용</label>
            <textarea
              rows={10}
              maxLength={typedMaxLength}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="주제에 맞는 글을 직접 작성해 주세요."
            />
            <p className="mt-2 text-right text-xs text-slate-500">
              {content.length} / {typedMaxLength}자
            </p>
          </div>

          {message ? (
            <NoticeBanner
              tone="success"
              title="글쓰기 제출 완료"
              description="제출이 저장되었습니다. 제출 기록 화면에서 피드백 상태를 확인할 수 있습니다."
            />
          ) : null}
          {error ? <NoticeBanner tone="error" title="글쓰기 제출 실패" description={error} /> : null}

          <div className="flex flex-wrap gap-3">
            <button type="submit">제출하기</button>
            <Link
              className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
              href="/student/history"
            >
              제출 기록으로 이동
            </Link>
          </div>
        </form>
      ) : (
        <form className="mt-4 space-y-4" onSubmit={handlePhotoSubmit}>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#5f4a3a]">글쓰기 사진</label>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => setImage(event.target.files?.[0] || null)}
            />
          </div>

          {message ? (
            <NoticeBanner
              tone="success"
              title="사진 제출 완료"
              description="사진이 저장되었습니다. 제출 기록 화면에서 피드백 상태를 확인할 수 있습니다."
            />
          ) : null}
          {error ? <NoticeBanner tone="error" title="사진 제출 실패" description={error} /> : null}

          <div className="flex flex-wrap gap-3">
            <button type="submit">사진 업로드하기</button>
            <Link
              className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
              href="/student/history"
            >
              제출 기록으로 이동
            </Link>
          </div>
        </form>
      )}
    </section>
  );
}

export default function StudentUploadPage() {
  return (
    <Suspense fallback={<section className="rounded-2xl bg-white p-6 shadow-sm">불러오는 중...</section>}>
      <StudentUploadContent />
    </Suspense>
  );
}
