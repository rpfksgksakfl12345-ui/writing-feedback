"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../../lib/api";

type RegisterResponse = {
  token: string;
  user: {
    id: number;
    email: string;
    name: string;
    role: "TEACHER";
    grade: number | null;
  };
};

const inputClass =
  "mt-2 h-11 w-full rounded-lg border border-ink-100 bg-paper-soft px-3.5 text-[15px] text-ink-900 outline-none transition placeholder:text-ink-300 focus:border-teacher-accent focus:ring-2 focus:ring-teacher-accent/20";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [teacherSignupCode, setTeacherSignupCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    setError("");

    if (!trimmedName || !trimmedEmail || !password || !passwordConfirm) {
      setError("이름, 이메일, 비밀번호와 비밀번호 확인을 모두 입력해 주세요.");
      return;
    }

    if (password !== passwordConfirm) {
      setError("비밀번호와 비밀번호 확인이 같지 않아요.");
      return;
    }

    setLoading(true);

    try {
      await apiFetch<RegisterResponse>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name: trimmedName,
          email: trimmedEmail,
          password,
          teacherSignupCode: teacherSignupCode.trim(),
        }),
      });

      router.push("/login?registered=1");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "교사 계정을 만들지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto flex min-h-[calc(100vh-140px)] max-w-[1240px] items-center justify-center rounded-[28px] border border-ink-100 bg-[#F6EBD3] px-6 py-10 shadow-[0_1px_2px_rgba(60,40,20,.06),0_18px_42px_rgba(60,40,20,.10)] sm:px-8">
      <div className="w-full max-w-[460px] rounded-2xl border border-ink-100 bg-paper-surface p-6 shadow-[0_18px_40px_-24px_rgba(60,40,20,.3)] sm:p-7">
        <p className="text-sm font-semibold text-teacher-accent">교사 회원가입</p>
        <h1 className="kr-keep mt-2 text-[24px] font-bold leading-[1.35] text-ink-900">
          교사 계정 만들기
        </h1>
        <p className="kr-keep mt-3 text-[14px] leading-[1.7] text-ink-700">
          학급을 만들고 학생들의 글쓰기를 관리할 선생님 계정을 만들어 주세요.
        </p>

        <form className="mt-7 grid gap-5" onSubmit={handleSubmit}>
          <label className="block text-[13px] font-medium text-ink-700">
            이름
            <input
              className={inputClass}
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              placeholder="홍길동"
            />
          </label>

          <label className="block text-[13px] font-medium text-ink-700">
            이메일
            <input
              className={inputClass}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              inputMode="email"
              placeholder="teacher@example.com"
              type="email"
            />
          </label>

          <label className="block text-[13px] font-medium text-ink-700">
            비밀번호
            <input
              className={inputClass}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              type="password"
            />
          </label>

          <label className="block text-[13px] font-medium text-ink-700">
            비밀번호 확인
            <input
              className={inputClass}
              value={passwordConfirm}
              onChange={(event) => setPasswordConfirm(event.target.value)}
              autoComplete="new-password"
              type="password"
            />
          </label>

          <label className="block text-[13px] font-medium text-ink-700">
            교사 가입 코드
            <input
              className={inputClass}
              value={teacherSignupCode}
              onChange={(event) => setTeacherSignupCode(event.target.value)}
              autoComplete="off"
              placeholder="관리자에게 받은 가입 코드를 입력해 주세요"
              type="password"
            />
            <span className="kr-keep mt-2 block text-xs leading-5 text-ink-500">
              처음 가입할 때만 필요해요. 코드를 모르면 관리자에게 문의해 주세요.
            </span>
          </label>

          {error ? (
            <div className="kr-keep rounded-xl border border-status-error/25 bg-status-error/10 px-4 py-3 text-sm leading-6 text-status-error">
              {error}
            </div>
          ) : null}

          <button
            className="inline-flex h-12 w-full items-center justify-center whitespace-nowrap rounded-lg bg-teacher-accent px-5 text-[15px] font-semibold text-paper-surface shadow-[0_1px_0_rgba(40,60,90,.15),0_2px_6px_rgba(60,80,120,.18)] hover:bg-teacher-deep disabled:cursor-not-allowed disabled:bg-ink-200"
            disabled={loading}
            type="submit"
          >
            {loading ? "계정 만드는 중..." : "계정 만들기"}
          </button>
        </form>

        <div className="kr-keep mt-6 space-y-3 text-center text-sm leading-6 text-ink-700">
          <p>
            이미 계정이 있나요?{" "}
            <Link
              className="whitespace-nowrap font-semibold text-teacher-accent hover:text-teacher-deep"
              href="/login"
            >
              로그인하기
            </Link>
          </p>
          <p className="text-ink-500">학생 계정은 선생님이 학급 관리에서 발급해요.</p>
        </div>
      </div>
    </section>
  );
}
