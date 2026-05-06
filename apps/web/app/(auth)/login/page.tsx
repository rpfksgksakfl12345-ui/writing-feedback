"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../components/auth-provider";
import { apiFetch } from "../../../lib/api";

type SessionUser = {
  id: number;
  email: string;
  name: string;
  role: "TEACHER" | "STUDENT";
  grade: number | null;
  studentProfile?: {
    classroomId: number;
    classroomName: string;
    classCode: string;
    studentNumber: number;
  } | null;
};

type LoginResponse = {
  token: string;
  user: SessionUser;
};

type LoginMode = "TEACHER" | "STUDENT";

const modeCopy: Record<
  LoginMode,
  {
    eyebrow: string;
    title: string;
    description: string;
    accentClass: string;
  }
> = {
  TEACHER: {
    eyebrow: "교사용 로그인",
    title: "교사 계정으로 들어가기",
    description: "이메일과 비밀번호로 주제, 학급, 제출 글을 관리하는 화면에 들어갑니다.",
    accentClass: "text-teacher-accent",
  },
  STUDENT: {
    eyebrow: "학생용 로그인",
    title: "학생 정보로 내 책장 열기",
    description: "선생님이 나눠준 학급코드, 내 번호, 로그인 비밀번호를 차례대로 입력합니다.",
    accentClass: "text-student-accent",
  },
};

function getHomeHref(role: "TEACHER" | "STUDENT") {
  return role === "TEACHER" ? "/teacher/topics" : "/student";
}

export default function LoginPage() {
  const router = useRouter();
  const { login, user, isReady } = useAuth();
  const [mode, setMode] = useState<LoginMode | null>(null);
  const [email, setEmail] = useState("teacher@test.com");
  const [password, setPassword] = useState("password123");
  const [classCode, setClassCode] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [classroomLoginPassword, setClassroomLoginPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isReady || !user) {
      return;
    }

    router.replace(getHomeHref(user.role));
  }, [isReady, router, user]);

  function selectMode(nextMode: LoginMode) {
    setMode(nextMode);
    setError("");
  }

  async function handleTeacherLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await apiFetch<LoginResponse>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      login(response.token, response.user);
      router.replace(getHomeHref(response.user.role));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "교사 로그인에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function handleStudentLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await apiFetch<LoginResponse>("/api/auth/student-login", {
        method: "POST",
        body: JSON.stringify({
          classCode,
          studentNumber: Number(studentNumber),
          classroomLoginPassword,
        }),
      });

      login(response.token, response.user);
      router.replace(getHomeHref(response.user.role));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "학생 로그인에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  const activeCopy = mode ? modeCopy[mode] : null;
  const teacherInputClass =
    "mt-2 h-11 rounded-md border-[#E8DEC7] bg-[#FFFAF0] text-sm text-[#2E2A24] transition duration-300 placeholder:text-[#A89C85] focus:border-teacher-accent focus:ring-teacher-accent/20";
  const studentInputClass =
    "mt-2 h-11 rounded-md border-[#E8DEC7] bg-[#FFFAF0] text-sm text-[#2E2A24] transition duration-300 placeholder:text-[#A89C85] focus:border-student-accent focus:ring-student-accent/20";

  return (
    <section className="mx-auto max-w-4xl overflow-hidden rounded-[28px] border border-[#E8DEC7] bg-paper-base shadow-sm">
      <div className="bg-[radial-gradient(rgba(120,90,50,.05)_1px,transparent_1px)] bg-[length:24px_24px] px-8 py-8">
        <p className={`text-sm font-semibold ${activeCopy?.accentClass ?? "text-teacher-accent"}`}>
          주제 글쓰기
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#2E2A24]">
          {activeCopy?.title ?? "어떻게 들어갈까요?"}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[#5A5247]">
          {activeCopy?.description ??
            "교사는 수업을 준비하고, 학생은 책장에서 글쓰기 주제를 골라 공책을 엽니다."}
        </p>

        {mode ? (
          <div className="mt-6 inline-flex rounded-md bg-[#F4ECDC] p-1">
            {(
              [
                { id: "TEACHER", label: "교사" },
                { id: "STUDENT", label: "학생" },
              ] satisfies Array<{ id: LoginMode; label: string }>
            ).map((tab) => {
              const isActive = mode === tab.id;

              return (
                <button
                  key={tab.id}
                  className={`min-h-10 whitespace-nowrap rounded-md px-5 py-2 text-sm font-semibold shadow-none ${
                    isActive
                      ? "bg-[#FFFAF0] text-[#2E2A24]"
                      : "bg-transparent text-[#5A5247] hover:bg-[#FFFAF0]/60"
                  }`}
                  type="button"
                  onClick={() => selectMode(tab.id)}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="px-8 pb-9">
        {!mode ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <button
              className="rounded-xl border border-[#D7E0EA] bg-[#FFFAF0] p-5 text-left text-[#2E2A24] shadow-sm transition duration-300 hover:border-teacher-accent hover:bg-[#F7F1E6]"
              type="button"
              onClick={() => selectMode("TEACHER")}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teacher-accent">
                교사 화면
              </p>
              <h2 className="mt-3 text-xl font-bold">교사용 로그인</h2>
              <p className="mt-2 text-sm leading-6 text-[#5A5247]">
                이메일과 비밀번호로 수업 주제, 학급, 피드백을 관리합니다.
              </p>
            </button>
            <button
              className="rounded-xl border border-[#F0DCC2] bg-[#FFFAF0] p-5 text-left text-[#2E2A24] shadow-sm transition duration-300 hover:border-student-accent hover:bg-[#F7F1E6]"
              type="button"
              onClick={() => selectMode("STUDENT")}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-student-accent">
                학생 화면
              </p>
              <h2 className="mt-3 text-xl font-bold">학생용 로그인</h2>
              <p className="mt-2 text-sm leading-6 text-[#5A5247]">
                안내 카드의 학급코드, 번호, 비밀번호로 내 글쓰기 책장을 엽니다.
              </p>
            </button>
          </div>
        ) : mode === "TEACHER" ? (
          <form className="mt-6 grid gap-5 rounded-xl border border-[#E8DEC7] bg-[#FFFAF0] p-5 shadow-sm" onSubmit={handleTeacherLogin}>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teacher-accent">
                {modeCopy.TEACHER.eyebrow}
              </p>
              <h2 className="mt-1 text-xl font-bold text-[#2E2A24]">교사 계정</h2>
              <p className="mt-2 text-sm leading-6 text-[#5A5247]">
                주제, 학급, 제출물을 관리하는 교사 화면으로 이동합니다.
              </p>
            </div>
            <label className="block text-sm font-semibold text-[#5A5247]">
              이메일
              <input
                className={teacherInputClass}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
              />
            </label>
            <label className="block text-sm font-semibold text-[#5A5247]">
              비밀번호
              <input
                className={teacherInputClass}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
              />
            </label>
            {error ? <p className="text-sm font-semibold text-[#B0533A]">{error}</p> : null}
            <button
              className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-md bg-teacher-accent px-[18px] py-[13px] text-[15px] font-semibold text-[#FFFAF0] shadow-[0_1px_0_rgba(40,60,90,.15),0_2px_6px_rgba(60,80,120,.18)] hover:bg-teacher-accent/90 disabled:cursor-not-allowed disabled:bg-[#D6CCB3]"
              disabled={loading}
              type="submit"
            >
              {loading ? "로그인 중..." : "교사 로그인"}
            </button>
          </form>
        ) : (
          <form className="mt-6 grid gap-5 rounded-xl border border-[#E8DEC7] bg-[#FFFAF0] p-5 shadow-sm" onSubmit={handleStudentLogin}>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-student-accent">
                {modeCopy.STUDENT.eyebrow}
              </p>
              <h2 className="mt-1 text-xl font-bold text-[#2E2A24]">학생 접속</h2>
              <p className="mt-2 text-sm leading-6 text-[#5A5247]">
                안내 카드에 적힌 학급코드, 번호, 로그인 비밀번호를 입력하세요.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-semibold text-[#5A5247]">
                학급코드
                <input
                  className={`${studentInputClass} uppercase`}
                  value={classCode}
                  onChange={(event) => setClassCode(event.target.value.toUpperCase())}
                  autoCapitalize="characters"
                />
              </label>
              <label className="block text-sm font-semibold text-[#5A5247]">
                번호
                <input
                  className={studentInputClass}
                  value={studentNumber}
                  onChange={(event) => setStudentNumber(event.target.value)}
                  inputMode="numeric"
                />
              </label>
            </div>
            <label className="block text-sm font-semibold text-[#5A5247]">
              로그인 비밀번호
              <input
                className={studentInputClass}
                value={classroomLoginPassword}
                onChange={(event) => setClassroomLoginPassword(event.target.value)}
                type="password"
              />
            </label>
            {error ? <p className="text-sm font-semibold text-[#B0533A]">{error}</p> : null}
            <button
              className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-md bg-student-accent px-[18px] py-[13px] text-[15px] font-semibold text-[#FFFAF0] shadow-[0_1px_0_rgba(120,60,30,.15),0_2px_6px_rgba(180,90,50,.18)] hover:bg-student-accent/90 disabled:cursor-not-allowed disabled:bg-[#D6CCB3]"
              disabled={loading}
              type="submit"
            >
              {loading ? "접속 중..." : "학생 로그인"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
