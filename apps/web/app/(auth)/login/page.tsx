"use client";

import { FormEvent, useState } from "react";
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
  const { login } = useAuth();
  const [email, setEmail] = useState("teacher@test.com");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
      router.push(response.user.role === "TEACHER" ? "/teacher/topics" : "/student/upload");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "로그인에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto max-w-md rounded-xl bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-semibold">로그인</h1>
      <p className="mt-2 text-sm text-slate-600">교사 또는 학생 계정으로 로그인하세요.</p>
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
        <button className="w-full" disabled={loading} type="submit">
          {loading ? "로그인 중..." : "로그인"}
        </button>
      </form>
      <div className="mt-4 text-xs text-slate-500">
        <p>교사: teacher@test.com / password123</p>
        <p>학생: student1@test.com / password123</p>
      </div>
    </section>
  );
}
