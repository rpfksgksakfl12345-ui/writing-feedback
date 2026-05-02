"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../components/auth-provider";
import { apiFetch } from "../../../lib/api";

type LoginResponse = {
  token: string;
  user: {
    id: number;
    email: string;
    name: string;
    role: "TEACHER" | "STUDENT";
    grade: number | null;
  };
};

export default function LoginPage() {
  const router = useRouter();
  const { login, user, isReady } = useAuth();
  const [email, setEmail] = useState("teacher@test.com");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isReady || !user) {
      return;
    }

    router.replace(user.role === "TEACHER" ? "/teacher/topics" : "/student/upload");
  }, [isReady, router, user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await apiFetch<LoginResponse>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      login(response.token, response.user);
      router.replace(response.user.role === "TEACHER" ? "/teacher/topics" : "/student/upload");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "로그인에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto max-w-md rounded-3xl border border-[#E8DEC7] bg-[#FFFAF0] p-8 shadow-sm">
      <h1 className="text-2xl font-semibold text-[#2E2A24]">로그인</h1>
      <p className="mt-2 text-sm leading-6 text-[#5A5247]">
        교사 또는 학생 체험 계정으로 로그인해 현재 MVP 흐름을 확인할 수 있습니다.
      </p>
      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="mb-1 block text-sm font-medium">이메일</label>
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">비밀번호</label>
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
          />
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button className="w-full bg-teacher-accent hover:bg-teacher-accent/90" disabled={loading} type="submit">
          {loading ? "로그인 중..." : "로그인"}
        </button>
      </form>
      <div className="mt-5 rounded-2xl bg-paper-base p-4 text-xs leading-5 text-[#5A5247]">
        <p className="font-semibold text-[#2E2A24]">체험 계정</p>
        <p>교사: teacher@test.com / password123</p>
        <p>학생: student1@test.com / password123</p>
      </div>
    </section>
  );
}
