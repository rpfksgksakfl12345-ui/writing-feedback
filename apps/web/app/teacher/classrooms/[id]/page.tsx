"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { NoticeBanner } from "../../../../components/notice-banner";
import { useAuth } from "../../../../components/auth-provider";
import { Badge, PrimaryButton } from "../../../../components/ui-v2";
import { apiFetch } from "../../../../lib/api";

type Classroom = {
  id: number;
  name: string;
  grade: number;
  classCode: string;
  createdAt: string;
};

type ClassroomStudent = {
  id: number;
  userId: number;
  name: string;
  grade: number | null;
  studentNumber: number;
  classroomLoginPassword: string;
  createdAt: string;
};

function formatDate(createdAt: string) {
  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    return "날짜 정보 없음";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
  }).format(date);
}

export default function TeacherClassroomDetailPage() {
  const params = useParams<{ id: string }>();
  const classroomId = Number(params.id);
  const { token, user, isReady } = useAuth();
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [students, setStudents] = useState<ClassroomStudent[]>([]);
  const [name, setName] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [classroomLoginPassword, setClassroomLoginPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const classroom = useMemo(
    () => classrooms.find((item) => item.id === classroomId) ?? null,
    [classroomId, classrooms],
  );

  async function loadClassroomData() {
    if (!token || !Number.isInteger(classroomId) || classroomId < 1) {
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const nextClassrooms = await apiFetch<Classroom[]>("/api/classrooms", { token });
      setClassrooms(nextClassrooms);

      if (nextClassrooms.some((item) => item.id === classroomId)) {
        const nextStudents = await apiFetch<ClassroomStudent[]>(
          `/api/classrooms/${classroomId}/students`,
          { token },
        );
        setStudents(nextStudents);
      } else {
        setStudents([]);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "학급 정보를 불러오지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadClassroomData();
  }, [classroomId, token]);

  async function handleCreateStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    setIsSaving(true);

    try {
      const body: {
        name: string;
        studentNumber: number;
        classroomLoginPassword?: string;
      } = {
        name,
        studentNumber: Number(studentNumber),
      };

      if (classroomLoginPassword.trim()) {
        body.classroomLoginPassword = classroomLoginPassword.trim();
      }

      const student = await apiFetch<ClassroomStudent>(`/api/classrooms/${classroomId}/students`, {
        method: "POST",
        token,
        body: JSON.stringify(body),
      });

      setName("");
      setStudentNumber("");
      setClassroomLoginPassword("");
      setMessage(`${student.name} 학생이 발급되었습니다. 번호 ${student.studentNumber}`);
      await loadClassroomData();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "학생을 발급하지 못했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isReady && user?.role !== "TEACHER") {
    return (
      <section className="rounded-xl border border-[#E8DEC7] bg-[#FFFAF0] p-6 text-[#5A5247] shadow-sm">
        교사 계정만 접근할 수 있습니다.
      </section>
    );
  }

  if (!Number.isInteger(classroomId) || classroomId < 1) {
    return (
      <section className="rounded-xl border border-[#E8DEC7] bg-[#FFFAF0] p-6 text-[#5A5247] shadow-sm">
        올바른 학급 주소가 아닙니다.
      </section>
    );
  }

  if (!isLoading && !classroom) {
    return (
      <section className="rounded-xl border border-[#E8DEC7] bg-[#FFFAF0] p-6 shadow-sm">
        <p className="text-lg font-semibold text-[#2E2A24]">학급을 찾을 수 없습니다.</p>
        <p className="mt-2 text-sm text-[#5A5247]">
          현재 교사 계정에 연결된 학급 목록에서 이 학급을 찾지 못했습니다.
        </p>
        <Link
          className="mt-5 inline-flex min-h-11 items-center justify-center rounded-md bg-teacher-accent px-[18px] py-[13px] text-[15px] font-semibold text-[#FFFAF0] hover:bg-teacher-accent/90"
          href="/teacher/classrooms"
        >
          학급 목록으로 돌아가기
        </Link>
      </section>
    );
  }

  return (
    <div className="overflow-hidden rounded-[28px] border border-[#E8DEC7] bg-paper-base shadow-sm">
      <section className="bg-[radial-gradient(rgba(90,110,133,.05)_1px,transparent_1px)] bg-[length:24px_24px] px-8 pb-7 pt-8">
        <Link
          className="inline-flex min-h-9 items-center rounded-md border border-[#E8DEC7] bg-[#FFFAF0] px-3 text-sm font-semibold text-[#5A5247] hover:bg-paper-base"
          href="/teacher/classrooms"
        >
          학급 목록
        </Link>
        <div className="mt-5 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-sm font-semibold text-teacher-accent">Classroom Roster</p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-[#2E2A24]">
              {classroom?.name ?? "학급을 불러오는 중"}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#5A5247]">
              학생을 한 명씩 발급하고 학급코드와 로그인 정보를 확인합니다.
            </p>
          </div>

          <div className="grid min-w-[280px] grid-cols-2 gap-3 rounded-xl border border-[#E8DEC7] bg-[#FFFAF0]/85 p-4 shadow-sm">
            <div>
              <p className="text-xs text-[#8B8170]">학년</p>
              <p className="mt-1 text-lg font-semibold text-[#2E2A24]">
                {classroom ? `${classroom.grade}학년` : "-"}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#8B8170]">학급코드</p>
              <p className="mt-1 font-mono text-lg font-bold tracking-[0.12em] text-teacher-accent">
                {classroom?.classCode ?? "-"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 px-8 pb-10 pt-7 xl:grid-cols-[minmax(340px,.85fr)_minmax(0,1.15fr)]">
        <section className="h-fit rounded-xl border border-[#E8DEC7] bg-[#FFFAF0] p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B8170]">
            Issue Student
          </p>
          <h2 className="mt-1 text-xl font-bold text-[#2E2A24]">학생 단건 발급</h2>
          <form className="mt-5 space-y-4" onSubmit={handleCreateStudent}>
            <label className="block text-sm font-semibold text-[#5A5247]">
              학생 이름
              <input
                className="mt-2 h-11 rounded-md border-[#E8DEC7] bg-[#FFFAF0] text-sm text-[#2E2A24] placeholder:text-[#A89C85] focus:border-teacher-accent focus:ring-teacher-accent/20"
                placeholder="예: 김하늘"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>

            <label className="block text-sm font-semibold text-[#5A5247]">
              번호
              <input
                className="mt-2 h-11 rounded-md border-[#E8DEC7] bg-[#FFFAF0] text-sm text-[#2E2A24] focus:border-teacher-accent focus:ring-teacher-accent/20"
                value={studentNumber}
                onChange={(event) => setStudentNumber(event.target.value)}
                inputMode="numeric"
              />
            </label>

            <label className="block text-sm font-semibold text-[#5A5247]">
              로그인 비밀번호
              <input
                className="mt-2 h-11 rounded-md border-[#E8DEC7] bg-[#FFFAF0] text-sm text-[#2E2A24] placeholder:text-[#A89C85] focus:border-teacher-accent focus:ring-teacher-accent/20"
                placeholder="비워두면 자동 생성"
                value={classroomLoginPassword}
                onChange={(event) => setClassroomLoginPassword(event.target.value)}
              />
            </label>

            {message ? <NoticeBanner tone="success" title="학생 발급 완료" description={message} /> : null}
            {error ? <NoticeBanner tone="error" title="학생 처리 실패" description={error} /> : null}

            <div className="flex justify-end">
              <PrimaryButton disabled={isSaving || !classroom} tone="teacher" type="submit">
                {isSaving ? "발급 중..." : "학생 발급"}
              </PrimaryButton>
            </div>
          </form>
        </section>

        <section className="rounded-xl border border-[#E8DEC7] bg-[#FFFAF0] p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B8170]">
                Student Roster
              </p>
              <h2 className="mt-1 text-xl font-bold text-[#2E2A24]">학생 명단</h2>
              <p className="mt-2 text-sm leading-6 text-[#5A5247]">
                이 정보는 교사용입니다. 학생에게는 학급코드, 번호, 로그인 비밀번호만 안내합니다.
              </p>
            </div>
            <Badge tone="teacher">{students.length}명</Badge>
          </div>

          {isLoading ? (
            <div className="mt-5 rounded-xl border border-dashed border-[#C9B998] bg-paper-base/60 px-6 py-12 text-center text-sm text-[#8B8170]">
              학생 명단을 불러오는 중입니다...
            </div>
          ) : null}

          {!isLoading && students.length === 0 ? (
            <div className="mt-5 rounded-xl border border-dashed border-[#C9B998] bg-paper-base/60 px-6 py-12 text-center">
              <p className="text-lg font-semibold text-[#2E2A24]">아직 학생이 없습니다.</p>
              <p className="mt-2 text-sm text-[#5A5247]">
                학생을 발급하면 이곳에서 로그인 정보를 확인할 수 있습니다.
              </p>
            </div>
          ) : null}

          {!isLoading && students.length > 0 ? (
            <div className="mt-5 space-y-3">
              {students.map((student) => (
                <article
                  key={student.id}
                  className="rounded-xl border border-[#E8DEC7] bg-paper-base/45 p-4"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="teacher">{student.studentNumber}번</Badge>
                        <span className="text-xs font-semibold text-[#8B8170]">
                          {formatDate(student.createdAt)}
                        </span>
                      </div>
                      <h3 className="mt-3 text-lg font-bold leading-tight text-[#2E2A24]">
                        {student.name}
                      </h3>
                      <p className="mt-1 text-sm text-[#5A5247]">
                        {student.grade ?? classroom?.grade ?? "-"}학년
                      </p>
                    </div>

                    <div className="grid gap-2 text-sm sm:grid-cols-3 lg:min-w-[420px]">
                      <div className="rounded-lg border border-[#E8DEC7] bg-[#FFFAF0] px-3 py-2">
                        <p className="text-xs text-[#8B8170]">학급코드</p>
                        <p className="mt-1 font-mono font-bold tracking-[0.12em] text-teacher-accent">
                          {classroom?.classCode ?? "-"}
                        </p>
                      </div>
                      <div className="rounded-lg border border-[#E8DEC7] bg-[#FFFAF0] px-3 py-2">
                        <p className="text-xs text-[#8B8170]">번호</p>
                        <p className="mt-1 font-semibold text-[#2E2A24]">{student.studentNumber}</p>
                      </div>
                      <div className="rounded-lg border border-[#E8DEC7] bg-[#FFFAF0] px-3 py-2">
                        <p className="text-xs text-[#8B8170]">로그인 비밀번호</p>
                        <p className="mt-1 font-mono font-bold text-[#2E2A24]">
                          {student.classroomLoginPassword}
                        </p>
                      </div>
                    </div>
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
