"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { NoticeBanner } from "../../../components/notice-banner";
import { useAuth } from "../../../components/auth-provider";
import { NeisSchoolPicker, type NeisSchool } from "../../../components/neis-school-picker";
import { Badge, PrimaryButton, SecondaryButton } from "../../../components/ui-v2";
import { apiFetch } from "../../../lib/api";

type Classroom = {
  id: number;
  name: string;
  grade: number;
  classCode: string;
  createdAt: string;
  neisOfficeCode: string | null;
  neisOfficeName: string | null;
  neisSchoolCode: string | null;
  neisSchoolName: string | null;
  neisSchoolLevel: string | null;
  neisSchoolAddress: string | null;
  neisSchoolHomepage: string | null;
};

const onboardingSteps = [
  {
    title: "학급 만들기",
    description: "우리 반 이름과 학년을 정해 첫 공간을 만듭니다.",
  },
  {
    title: "학생 계정 발급",
    description: "학급 상세에서 학생 번호와 로그인 비밀번호를 발급합니다.",
  },
  {
    title: "글쓰기 주제 만들기",
    description: "우리 반 공책 책장에 보낼 첫 주제를 준비합니다.",
  },
];

function formatClassroomDate(createdAt: string) {
  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    return "생성일 정보 없음";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
  }).format(date);
}

export default function TeacherClassroomsPage() {
  const { token, user, isReady } = useAuth();
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("3");
  const [selectedSchool, setSelectedSchool] = useState<NeisSchool | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingClassroomId, setDeletingClassroomId] = useState<number | null>(null);

  async function loadClassrooms() {
    if (!token) {
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const data = await apiFetch<Classroom[]>("/api/classrooms", { token });
      setClassrooms(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "학급 목록을 불러오지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadClassrooms();
  }, [token]);

  async function handleCreateClassroom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    setIsSaving(true);

    try {
      const classroom = await apiFetch<Classroom>("/api/classrooms", {
        method: "POST",
        token,
        body: JSON.stringify({ name, grade: Number(grade), neisSchool: selectedSchool }),
      });

      setName("");
      setGrade("3");
      setSelectedSchool(null);
      setMessage(`${classroom.name} 학급을 만들었어요. 학생 로그인에 쓸 학급코드: ${classroom.classCode}`);
      await loadClassrooms();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "학급을 생성하지 못했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteClassroom(classroom: Classroom) {
    if (!token || deletingClassroomId) {
      return;
    }

    const confirmed = window.confirm(
      `${classroom.name} 학급을 삭제할까요?\n\n학생, 주제, 제출글이 연결된 학급은 삭제되지 않습니다.`,
    );

    if (!confirmed) {
      return;
    }

    setMessage("");
    setError("");
    setDeletingClassroomId(classroom.id);

    try {
      await apiFetch<void>(`/api/classrooms/${classroom.id}`, {
        method: "DELETE",
        token,
      });
      setMessage(`${classroom.name} 학급을 삭제했습니다.`);
      await loadClassrooms();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "학급을 삭제하지 못했습니다.");
    } finally {
      setDeletingClassroomId(null);
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
  const hasClassrooms = classrooms.length > 0;

  return (
    <div className="overflow-hidden rounded-[28px] border border-ink-100 bg-paper-soft shadow-[0_1px_2px_rgba(60,40,20,.06),0_14px_34px_rgba(60,40,20,.08)]">
      <section className="bg-paper-surface bg-[radial-gradient(rgba(90,110,133,.07)_1px,transparent_1px)] bg-[length:24px_24px] px-8 pb-7 pt-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-sm font-semibold text-teacher-accent">교사 학급</p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-ink-900">우리 반 관리</h1>
            <p className="kr-keep mt-3 max-w-2xl text-sm leading-6 text-ink-700">
              학급코드를 만들고, 학생 로그인 계정을 발급한 뒤 공책 글쓰기 주제를 보냅니다.
            </p>
          </div>

          <div className="grid min-w-[240px] grid-cols-2 gap-3 rounded-xl border border-ink-100 bg-paper-surface/85 p-4 shadow-sm">
            <div>
              <p className="text-xs text-ink-500">전체 학급</p>
              <p className="mt-1 text-lg font-semibold text-ink-900">{classrooms.length}</p>
            </div>
            <div>
              <p className="text-xs text-ink-500">최근 코드</p>
              <p className="mt-1 text-lg font-semibold text-teacher-accent">
                {classrooms[0]?.classCode ?? "-"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 px-8 pb-10 pt-7 xl:grid-cols-[minmax(340px,.85fr)_minmax(0,1.15fr)]">
        <section className="h-fit rounded-xl border border-dashed border-teacher-accent/30 bg-paper-soft/75 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-500">
            새 학급
          </p>
          <h2 className="kr-keep mt-1 text-xl font-bold text-ink-900">
            {hasClassrooms ? "학급 만들기" : "첫 학급 만들기"}
          </h2>
          <p className="kr-keep mt-2 text-sm leading-6 text-ink-700">
            학급을 만들면 학생 로그인 계정을 발급하고 공책 글쓰기 주제를 보낼 수 있어요.
          </p>

          {!isLoading && !hasClassrooms ? (
            <ol className="kr-keep mt-5 grid gap-3 rounded-xl border border-teacher-accent/20 bg-paper-surface/80 p-4">
              {onboardingSteps.map((step, index) => (
                <li key={step.title} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teacher-accent text-xs font-bold text-paper-surface">
                    {index + 1}
                  </span>
                  <span>
                    <span className="block text-sm font-bold text-ink-900">{step.title}</span>
                    <span className="mt-0.5 block text-xs leading-5 text-ink-600">
                      {step.description}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          ) : null}

          <form className="mt-5 space-y-4" onSubmit={handleCreateClassroom}>
            <label className="block text-sm font-semibold text-ink-700">
              학급명
              <input
                className="mt-2 h-11 rounded-md border-ink-100 bg-paper-surface text-sm text-ink-900 placeholder:text-ink-300 focus:border-teacher-accent focus:ring-teacher-accent/20"
                placeholder="예: 3학년 1반"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>

            <label className="block text-sm font-semibold text-ink-700">
              학년
              <select
                className="mt-2 h-11 rounded-md border-ink-100 bg-paper-surface text-sm text-ink-900 focus:border-teacher-accent focus:ring-teacher-accent/20"
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

            <NeisSchoolPicker
              disabled={isSaving}
              onClear={() => setSelectedSchool(null)}
              onSelect={setSelectedSchool}
              selectedSchool={selectedSchool}
              token={token}
            />

            {message ? <NoticeBanner tone="success" title="학급 만들기 완료" description={message} /> : null}
            {error ? <NoticeBanner tone="error" title="학급 처리 실패" description={error} /> : null}

            <div className="flex justify-end">
              <PrimaryButton className="min-w-[120px]" disabled={isSaving} tone="teacher" type="submit">
                {isSaving ? "생성 중..." : "우리 반 만들기"}
              </PrimaryButton>
            </div>
          </form>
        </section>

        <section className="rounded-xl border border-ink-100 bg-paper-surface p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-500">
                학급 목록
              </p>
              <h2 className="mt-1 text-xl font-bold text-ink-900">학급 목록</h2>
              <p className="mt-2 text-sm leading-6 text-ink-700">
                학급을 선택하면 학생 계정 발급, 로그인 안내 카드, 학교 일정 연결을 관리할 수 있습니다.
              </p>
            </div>
            <Badge tone="teacher">{classrooms.length}개</Badge>
          </div>

          {isLoading ? (
            <div className="mt-5 rounded-xl border border-dashed border-ink-200 bg-paper-base/60 px-6 py-12 text-center text-sm text-ink-500">
              학급 목록을 불러오는 중입니다...
            </div>
          ) : null}

          {!isLoading && classrooms.length === 0 ? (
            <div className="kr-keep mt-5 rounded-xl border border-dashed border-teacher-accent/35 bg-teacher-soft/45 px-6 py-12 text-center">
              <p className="text-lg font-semibold text-ink-900">
                먼저 우리 반 학급을 만들어주세요.
              </p>
              <p className="mx-auto mt-2 max-w-[520px] text-sm leading-6 text-ink-700">
                학급을 만들면 학생 로그인 계정을 발급하고 공책 글쓰기 주제를 보낼 수 있어요.
                왼쪽의 첫 학급 만들기 카드에서 바로 시작하세요.
              </p>
            </div>
          ) : null}

          {!isLoading && classrooms.length > 0 ? (
            <div className="mt-5 grid gap-4">
              {classrooms.map((classroom) => (
                <article
                  key={classroom.id}
                  className="relative overflow-hidden rounded-xl border border-ink-100 bg-paper-surface p-4 shadow-sm transition hover:border-teacher-accent/35 hover:bg-paper-base/60"
                >
                  <span className="absolute inset-y-0 left-0 w-2 bg-teacher-accent/80" />
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="pl-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="teacher">{classroom.grade}학년</Badge>
                        <span className="text-xs font-semibold text-ink-500">
                          {formatClassroomDate(classroom.createdAt)}
                        </span>
                      </div>
                      <h3 className="mt-3 text-lg font-bold leading-tight text-ink-900">
                        {classroom.name}
                      </h3>
                      <p className="mt-2 text-xs leading-5 text-ink-600">
                        {classroom.neisSchoolName
                          ? `연결 학교: ${classroom.neisSchoolName}`
                          : "학교 미연결 · 학급 상세에서 연결 가능"}
                      </p>
                    </div>
                    <div className="rounded-lg border border-teacher-accent/20 bg-teacher-soft/70 px-4 py-3 text-right">
                      <p className="text-xs text-ink-500">학급코드</p>
                      <p className="mt-1 font-mono text-lg font-bold tracking-[0.12em] text-teacher-accent">
                        {classroom.classCode}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap justify-end gap-2 pl-3">
                    <Link
                      className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-md border border-ink-100 bg-paper-surface px-4 text-sm font-semibold text-ink-900 hover:bg-paper-base"
                      href={`/teacher/classrooms/${classroom.id}`}
                    >
                      학생 계정 발급하기
                    </Link>
                    <SecondaryButton
                      className="h-10 min-h-10 border-status-error/25 px-4 text-status-error hover:bg-status-error/5"
                      disabled={deletingClassroomId === classroom.id}
                      onClick={() => void handleDeleteClassroom(classroom)}
                      type="button"
                    >
                      {deletingClassroomId === classroom.id ? "삭제 중..." : "학급 삭제"}
                    </SecondaryButton>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      </section>
    </div>
  );
}
