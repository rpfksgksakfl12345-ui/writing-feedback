"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
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

type LoginMode = "STUDENT" | "TEACHER";

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
    title: "우리 반 공책 글쓰기 확인하기",
    description: "우리 반 주제, 제출 글, 담임 피드백을 한곳에서 관리해요.",
    accentClass: "text-teacher-accent",
  },
  STUDENT: {
    eyebrow: "학생용 로그인",
    title: "우리 반 책장 열기",
    description: "공책에 쓴 글을 우리 반 책장에 올려요.",
    accentClass: "text-student-accent",
  },
};

const shouldPrefillDevStudentLogin = process.env.NODE_ENV !== "production";
const devStudentLoginDefaults = {
  classCode: "C911F5",
  studentNumber: "1",
  classroomLoginPassword: "866554",
};

function getHomeHref(
  role: "TEACHER" | "STUDENT",
  options: { registeredNotice?: boolean; hasNoClassrooms?: boolean } = {},
) {
  if (role === "STUDENT") {
    return "/student";
  }

  return options.registeredNotice || options.hasNoClassrooms
    ? "/teacher/classrooms"
    : "/teacher/topics";
}

function getLoginErrorMessage(error: unknown, mode: LoginMode) {
  const rawMessage = error instanceof Error ? error.message : "";
  const normalizedMessage = rawMessage.toLowerCase();

  if (
    normalizedMessage.includes("failed to fetch") ||
    normalizedMessage.includes("networkerror") ||
    normalizedMessage.includes("network request failed")
  ) {
    return "서버와 연결하지 못했어요. 잠시 후 다시 시도해 주세요.";
  }

  if (
    normalizedMessage.includes("invalid credentials") ||
    normalizedMessage.includes("invalid classroom login credentials") ||
    normalizedMessage.includes("invalid email or password") ||
    normalizedMessage.includes("credentials") ||
    normalizedMessage.includes("unauthorized") ||
    normalizedMessage.includes("user not found") ||
    normalizedMessage.includes("password")
  ) {
    return mode === "STUDENT"
      ? "학급코드, 번호, 로그인 비밀번호를 다시 확인해 주세요."
      : "이메일 또는 비밀번호가 올바르지 않아요.";
  }

  return "로그인 중 문제가 생겼어요. 입력한 정보를 다시 확인해 주세요.";
}

async function getTeacherLoginHref(token: string, registeredNotice: boolean) {
  if (registeredNotice) {
    return "/teacher/classrooms";
  }

  try {
    const classrooms = await apiFetch<Array<{ id: number }>>("/api/classrooms", { token });
    return getHomeHref("TEACHER", { hasNoClassrooms: classrooms.length === 0 });
  } catch {
    return getHomeHref("TEACHER");
  }
}

export default function LoginPage() {
  const router = useRouter();
  const { login, user, isReady } = useAuth();
  const [mode, setMode] = useState<LoginMode>("STUDENT");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [classCode, setClassCode] = useState(
    shouldPrefillDevStudentLogin ? devStudentLoginDefaults.classCode : "",
  );
  const [studentNumber, setStudentNumber] = useState(
    shouldPrefillDevStudentLogin ? devStudentLoginDefaults.studentNumber : "",
  );
  const [classroomLoginPassword, setClassroomLoginPassword] = useState(
    shouldPrefillDevStudentLogin ? devStudentLoginDefaults.classroomLoginPassword : "",
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [registeredNotice, setRegisteredNotice] = useState(false);
  const [postLoginHref, setPostLoginHref] = useState<string | null>(null);

  useEffect(() => {
    if (!isReady || !user) {
      return;
    }

    router.replace(postLoginHref ?? getHomeHref(user.role, { registeredNotice }));
  }, [isReady, postLoginHref, registeredNotice, router, user]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setRegisteredNotice(params.get("registered") === "1");
  }, []);

  function selectMode(nextMode: LoginMode) {
    setMode(nextMode);
    setError("");

    if (nextMode === "STUDENT" && shouldPrefillDevStudentLogin) {
      setClassCode((currentValue) => currentValue || devStudentLoginDefaults.classCode);
      setStudentNumber((currentValue) => currentValue || devStudentLoginDefaults.studentNumber);
      setClassroomLoginPassword(
        (currentValue) => currentValue || devStudentLoginDefaults.classroomLoginPassword,
      );
    }
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

      const nextHref =
        response.user.role === "TEACHER"
          ? await getTeacherLoginHref(response.token, registeredNotice)
          : getHomeHref(response.user.role);

      setPostLoginHref(nextHref);
      login(response.token, response.user);
      router.replace(nextHref);
    } catch (submitError) {
      setError(getLoginErrorMessage(submitError, "TEACHER"));
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

      const nextHref = getHomeHref(response.user.role);
      setPostLoginHref(nextHref);
      login(response.token, response.user);
      router.replace(nextHref);
    } catch (submitError) {
      setError(getLoginErrorMessage(submitError, "STUDENT"));
    } finally {
      setLoading(false);
    }
  }

  const activeCopy = mode ? modeCopy[mode] : null;
  const teacherInputClass =
    "mt-2 h-11 w-full rounded-md border-ink-100 bg-paper-surface text-sm text-ink-900 transition duration-300 placeholder:text-ink-300 focus:border-teacher-accent focus:ring-teacher-accent/20";
  const studentInputClass =
    "mt-2 h-11 w-full rounded-md border-ink-100 bg-paper-surface text-sm text-ink-900 transition duration-300 placeholder:text-ink-300 focus:border-student-accent focus:ring-student-accent/20";

  return (
    <section className="mx-auto grid max-w-6xl overflow-hidden rounded-[28px] border border-ink-100 bg-[#F6EBD3] shadow-[0_1px_2px_rgba(60,40,20,.06),0_18px_42px_rgba(60,40,20,.10)] lg:grid-cols-[1.05fr_.95fr]">
      <div className="relative hidden min-h-[660px] overflow-hidden bg-paper-surface bg-[radial-gradient(rgba(120,90,50,.065)_1px,transparent_1px)] bg-[length:22px_22px] px-12 py-10 lg:block">
        <div className="relative z-10 flex items-start gap-3">
          <div className="font-brand-logo flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-student-soft text-base font-bold text-student-deep shadow-[inset_0_1px_rgba(255,255,255,.55),0_8px_18px_rgba(120,70,30,.12)]">
            글
          </div>
          <div className="kr-keep">
            <p className="font-brand-logo text-2xl font-bold leading-6 text-ink-900">공책톡톡</p>
            <p className="mt-0.5 text-xs font-semibold tracking-[0.12em] text-ink-500">
              공책과 피드백을 잇는 교실 도구
            </p>
          </div>
        </div>

        <div className="relative z-10 mt-16 max-w-[620px]">
          <p className="font-login-hand kr-keep text-[20px] font-bold leading-relaxed text-student-accent">
            공책에 쓴 글을 톡 올리면,
          </p>
          <h1 className="font-login-display kr-keep mt-4 font-bold leading-[1.18] text-ink-900">
            <span className="font-brand-logo block text-[58px] leading-none xl:text-[68px]">
              공책톡톡
            </span>
            <span className="mt-3 block text-[34px] xl:text-[40px]">
              우리 반 공책 글쓰기 책장.
            </span>
          </h1>
          <p className="font-login-hand kr-keep mt-6 max-w-[560px] text-[17px] font-normal leading-[1.7] text-ink-700 xl:text-[18px]">
            손글씨 공책 사진, 글 확인, AI 초안, 담임 피드백이
            <br />
            교실 글쓰기 흐름 안에서 자연스럽게 이어집니다.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {["학교 일정 맥락 추천", "공책 사진 제출", "담임 피드백 완성"].map((badge) => (
              <span
                className="rounded-full border border-ink-100 bg-paper-soft px-3 py-1 text-xs font-semibold text-ink-700"
                key={badge}
              >
                {badge}
              </span>
            ))}
          </div>
        </div>

        <div className="absolute bottom-12 left-12 flex items-end gap-3">
          {[
            {
              date: "4월 12일",
              title: "봄을 보고 느낀 것",
              color: "bg-student-accent/75",
              tilt: "-rotate-[1deg]",
            },
            {
              date: "4월 15일",
              title: "내가 사랑하는 사람",
              color: "bg-status-feedbackDone/75",
              tilt: "rotate-0",
            },
            {
              date: "4월 18일",
              title: "만약 하루를 바꿀 수...",
              color: "bg-teacher-accent/75",
              tilt: "rotate-[1deg]",
            },
          ].map((card) => (
            <div
              key={card.date}
              className={`h-[188px] w-[144px] shrink-0 rounded-lg border border-ink-100 bg-paper-surface p-4 shadow-[0_8px_18px_rgba(80,55,25,.10)] ${card.tilt}`}
            >
              <div className={`h-2 w-full rounded-full ${card.color}`} />
              <p className="kr-keep mt-6 text-[12px] font-semibold leading-5 text-ink-500">
                {card.date}
              </p>
              <p className="kr-keep mt-3 line-clamp-3 text-[14px] font-bold leading-[1.55] text-ink-900">
                {card.title}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-paper-soft px-6 py-6 sm:px-8 lg:px-8 lg:py-8">
        <div className="rounded-2xl border border-ink-100 bg-paper-surface p-4 shadow-sm sm:p-5">
          <div className="kr-keep mb-4 rounded-xl border border-teacher-accent/15 bg-teacher-soft/45 px-4 py-3">
            <p className="font-brand-logo text-[30px] font-bold leading-none text-ink-900">
              공책톡톡
            </p>
            <p className="mt-2 text-sm leading-6 text-ink-700">
              우리 반 공책 글쓰기를 사진 제출, 글 확인, 담임 피드백으로 이어주는 도구입니다.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-paper-surface px-3 py-1 text-xs font-semibold text-teacher-deep">
                학교 일정 참고
              </span>
              <span className="rounded-full bg-paper-surface px-3 py-1 text-xs font-semibold text-student-deep">
                우리 반 책장
              </span>
            </div>
          </div>

          <p className={`text-sm font-semibold ${activeCopy?.accentClass ?? "text-teacher-accent"}`}>
            {activeCopy?.eyebrow ?? "출입 카드"}
          </p>
          <h2 className="kr-keep mt-2 text-3xl font-bold tracking-tight text-ink-900">
            {activeCopy?.title ?? "어떻게 들어갈까요?"}
          </h2>
            <p className="kr-keep mt-3 text-sm leading-6 text-ink-700">
            {activeCopy?.description ??
              "학생은 공책에 쓰고, 선생님은 글을 확인해 피드백을 남깁니다."}
          </p>

          {registeredNotice ? (
            <div className="kr-keep mt-5 rounded-xl border border-status-feedbackDone/25 bg-status-feedbackDone/15 px-4 py-3 text-sm leading-6 text-status-feedbackDone">
              교사 계정이 만들어졌어요. 이메일과 비밀번호로 로그인해 주세요.
            </div>
          ) : null}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {(
              [
                {
                  id: "STUDENT",
                  eyebrow: "학생 로그인",
                  title: "학생으로 들어가기",
                  description: "학급코드, 번호, 로그인 비밀번호로 내 책장을 열어요.",
                  accent: "student",
                },
                {
                  id: "TEACHER",
                  eyebrow: "선생님 로그인",
                  title: "선생님으로 들어가기",
                  description: "주제 만들기, 제출 확인, 피드백 작성을 이어서 할 수 있어요.",
                  accent: "teacher",
                },
              ] satisfies Array<{
                id: LoginMode;
                eyebrow: string;
                title: string;
                description: string;
                accent: "teacher" | "student";
              }>
            ).map((card) => {
              const isActive = mode === card.id;
              const accentTextClass =
                card.accent === "teacher" ? "text-teacher-accent" : "text-student-accent";
              const activeCardClass =
                card.accent === "teacher"
                  ? "border-teacher-accent bg-teacher-soft/75 ring-2 ring-teacher-accent/20"
                  : "border-student-accent bg-student-soft/75 ring-2 ring-student-accent/20";
              const inactiveCardClass =
                "border-ink-100 bg-paper-surface hover:border-ink-200 hover:bg-paper-base/70";

              return (
                <button
                  key={card.id}
                  className={`kr-keep rounded-xl border p-3 text-left shadow-sm transition hover:-translate-y-0.5 ${
                    isActive ? activeCardClass : inactiveCardClass
                  }`}
                  type="button"
                  onClick={() => selectMode(card.id)}
                >
                  <span className={`text-xs font-semibold uppercase tracking-[0.16em] ${accentTextClass}`}>
                    {card.eyebrow}
                  </span>
                  <span className="mt-2 block text-base font-bold leading-6 text-ink-900">
                    {card.title}
                  </span>
                  <span className="mt-2 block text-sm leading-6 text-ink-700">
                    {card.description}
                  </span>
                  <span
                    className={`mt-3 inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${
                      isActive
                        ? `${accentTextClass} bg-paper-surface/80`
                        : "bg-paper-base text-ink-500"
                    }`}
                  >
                    {isActive ? "선택됨" : "선택하기"}
                  </span>
                </button>
              );
            })}
          </div>

          {mode === "TEACHER" ? (
          <form className="mt-4 grid gap-4 rounded-xl border border-teacher-accent/20 bg-paper-soft/70 p-4 shadow-sm" onSubmit={handleTeacherLogin}>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teacher-accent">
                {modeCopy.TEACHER.eyebrow}
              </p>
              <h2 className="kr-keep mt-1 text-xl font-bold text-ink-900">교사 계정</h2>
              <p className="kr-keep mt-2 text-sm leading-6 text-ink-700">
                우리 반 공책 글쓰기를 모아 보고 담임 피드백을 완성합니다.
              </p>
            </div>
            <label className="block text-sm font-semibold text-ink-700">
              이메일
              <input
                className={teacherInputClass}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
              />
            </label>
            <label className="block text-sm font-semibold text-ink-700">
              비밀번호
              <input
                className={teacherInputClass}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
              />
            </label>
            <p className="kr-keep text-sm leading-6 text-ink-600">
              비밀번호를 잊으셨나요? 관리자에게 문의해 주세요.
            </p>
            {error ? (
              <p className="kr-keep text-sm font-semibold leading-6 text-status-error">{error}</p>
            ) : null}
            <button
              className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-md bg-teacher-accent px-[18px] py-[13px] text-[15px] font-semibold text-paper-surface shadow-[0_1px_0_rgba(40,60,90,.15),0_2px_6px_rgba(60,80,120,.18)] hover:bg-teacher-accent/90 disabled:cursor-not-allowed disabled:bg-ink-200"
              disabled={loading}
              type="submit"
            >
              {loading ? "로그인 중..." : "우리 반 피드백 보러 가기 →"}
            </button>
            <p className="kr-keep text-center text-sm leading-6 text-ink-700">
              계정이 아직 없나요?{" "}
              <Link
                className="whitespace-nowrap font-semibold text-teacher-accent hover:text-teacher-deep"
                href="/register"
              >
                교사 계정 만들기
              </Link>
            </p>
          </form>
        ) : mode === "STUDENT" ? (
          <form className="mt-4 grid gap-4 rounded-xl border border-student-accent/20 bg-paper-soft/70 p-4 shadow-sm" onSubmit={handleStudentLogin}>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-student-accent">
                {modeCopy.STUDENT.eyebrow}
              </p>
              <h2 className="kr-keep mt-1 text-xl font-bold text-ink-900">학생 접속</h2>
              <p className="kr-keep mt-2 text-sm leading-6 text-ink-700">
                선생님이 나눠준 안내 카드의 학급코드, 번호, 로그인 비밀번호를 입력하세요.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-semibold text-ink-700">
                학급코드
                <input
                  className={`${studentInputClass} uppercase`}
                  value={classCode}
                  onChange={(event) => setClassCode(event.target.value.toUpperCase())}
                  autoCapitalize="characters"
                />
              </label>
              <label className="block text-sm font-semibold text-ink-700">
                번호
                <input
                  className={studentInputClass}
                  value={studentNumber}
                  onChange={(event) => setStudentNumber(event.target.value)}
                  inputMode="numeric"
                />
              </label>
            </div>
            <label className="block text-sm font-semibold text-ink-700">
              로그인 비밀번호
              <input
                className={studentInputClass}
                value={classroomLoginPassword}
                onChange={(event) => setClassroomLoginPassword(event.target.value)}
                type="password"
              />
            </label>
            {error ? (
              <p className="kr-keep text-sm font-semibold leading-6 text-status-error">{error}</p>
            ) : null}
            <button
              className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-md bg-student-accent px-[18px] py-[13px] text-[15px] font-semibold text-paper-surface shadow-[0_1px_0_rgba(120,60,30,.15),0_2px_6px_rgba(180,90,50,.18)] hover:bg-student-accent/90 disabled:cursor-not-allowed disabled:bg-ink-200"
              disabled={loading}
              type="submit"
            >
              {loading ? "접속 중..." : "내 공책 책장 열기 →"}
            </button>
            <p className="kr-keep text-center text-sm leading-6 text-ink-500">
              학생 계정은 선생님이 학급 관리에서 발급해요.
            </p>
          </form>
        ) : null}
        </div>
      </div>
    </section>
  );
}
