"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { NoticeBanner } from "../../../components/notice-banner";
import { useAuth } from "../../../components/auth-provider";
import { Badge, PrimaryButton } from "../../../components/ui-v2";
import { apiFetch } from "../../../lib/api";

type Classroom = {
  id: number;
  name: string;
  grade: number;
  classCode: string;
  createdAt: string;
};

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
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

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
        body: JSON.stringify({ name, grade: Number(grade) }),
      });

      setName("");
      setGrade("3");
      setMessage(`${classroom.name} 학급이 생성되었습니다. 학급코드: ${classroom.classCode}`);
      await loadClassrooms();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "학급을 생성하지 못했습니다.");
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

  const gradeOptions = [1, 2, 3, 4, 5, 6];

  return (
    <div className="overflow-hidden rounded-[28px] border border-ink-100 bg-paper-soft shadow-[0_1px_2px_rgba(60,40,20,.06),0_14px_34px_rgba(60,40,20,.08)]">
      <section className="bg-paper-surface bg-[radial-gradient(rgba(90,110,133,.07)_1px,transparent_1px)] bg-[length:24px_24px] px-8 pb-7 pt-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-sm font-semibold text-teacher-accent">교사 학급</p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-ink-900">학급 관리</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-700">
              학급을 만들고 학생 접속에 사용할 학급코드를 확인합니다.
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
        <section className="h-fit rounded-xl border border-ink-100 bg-paper-surface p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-500">
            새 학급
          </p>
          <h2 className="mt-1 text-xl font-bold text-ink-900">학급 만들기</h2>
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

            {message ? <NoticeBanner tone="success" title="학급 생성 완료" description={message} /> : null}
            {error ? <NoticeBanner tone="error" title="학급 처리 실패" description={error} /> : null}

            <div className="flex justify-end">
              <PrimaryButton disabled={isSaving} tone="teacher" type="submit">
                {isSaving ? "생성 중..." : "학급 생성"}
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
                학급을 선택하면 학생 명단과 로그인 정보를 관리할 수 있습니다.
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
            <div className="mt-5 rounded-xl border border-dashed border-ink-200 bg-paper-base/60 px-6 py-12 text-center">
              <p className="text-lg font-semibold text-ink-900">아직 학급이 없습니다.</p>
              <p className="mt-2 text-sm text-ink-700">
                첫 학급을 만들면 학생 접속 코드가 자동으로 발급됩니다.
              </p>
            </div>
          ) : null}

          {!isLoading && classrooms.length > 0 ? (
            <div className="mt-5 grid gap-3">
              {classrooms.map((classroom) => (
                <Link
                  key={classroom.id}
                  className="rounded-xl border border-ink-100 bg-paper-base/45 p-4 transition hover:bg-paper-base/70"
                  href={`/teacher/classrooms/${classroom.id}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="teacher">{classroom.grade}학년</Badge>
                        <span className="text-xs font-semibold text-ink-500">
                          {formatClassroomDate(classroom.createdAt)}
                        </span>
                      </div>
                      <h3 className="mt-3 text-lg font-bold leading-tight text-ink-900">
                        {classroom.name}
                      </h3>
                    </div>
                    <div className="rounded-lg border border-ink-100 bg-paper-surface px-4 py-3 text-right">
                      <p className="text-xs text-ink-500">학급코드</p>
                      <p className="mt-1 font-mono text-lg font-bold tracking-[0.12em] text-teacher-accent">
                        {classroom.classCode}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : null}
        </section>
      </section>
    </div>
  );
}
