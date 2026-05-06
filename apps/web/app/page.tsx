"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../components/auth-provider";

export default function HomePage() {
  const router = useRouter();
  const { isReady, user } = useAuth();
  const isLoggedIn = isReady && Boolean(user);

  useEffect(() => {
    if (!isReady || !user) {
      return;
    }

    router.replace(user.role === "TEACHER" ? "/teacher/topics" : "/student");
  }, [isReady, router, user]);

  if (isLoggedIn) {
    return <p className="rounded-xl bg-paper-surface p-6 shadow-sm">Redirecting to your workspace...</p>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-teacher-deep px-8 py-10 text-paper-surface shadow-sm">
        <p className="text-sm font-medium text-teacher-soft">초등 글쓰기 피드백 MVP</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          교사는 빠르게 확인하고,
          <br />
          학생은 쉽게 제출하고 다시 볼 수 있게 정리했습니다.
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-teacher-soft">
          주제 생성, 사진 업로드, 교사 피드백 저장, 학생 기록 확인 흐름을 기준으로 바로
          이동할 수 있습니다.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {isLoggedIn ? (
            <Link
              className="whitespace-nowrap rounded-xl bg-paper-surface px-4 py-2.5 text-sm font-medium text-ink-900"
              href={user?.role === "TEACHER" ? "/teacher/topics" : "/student"}
            >
              {user?.role === "TEACHER" ? "교사 작업 이어가기" : "학생 제출 이어가기"}
            </Link>
          ) : (
            <Link
              className="whitespace-nowrap rounded-xl bg-paper-surface px-4 py-2.5 text-sm font-medium text-ink-900"
              href="/login"
            >
              체험 계정으로 로그인
            </Link>
          )}
          <Link
            className="whitespace-nowrap rounded-xl border border-teacher-soft/40 px-4 py-2.5 text-sm font-medium text-paper-surface"
            href="/student/history"
          >
            학생 기록 화면 보기
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl bg-paper-surface p-6 shadow-sm">
          <p className="text-sm font-semibold text-ink-500">교사 동선</p>
          <h2 className="mt-2 text-xl font-semibold">주제 만들기 후 제출 확인</h2>
          <ol className="mt-4 space-y-3 text-sm text-ink-700">
            <li>1. 학년별 글쓰기 주제를 등록합니다.</li>
            <li>2. 학생이 올린 제출물을 확인합니다.</li>
            <li>3. 피드백 저장 후 바로 목록으로 돌아갑니다.</li>
          </ol>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              className="whitespace-nowrap rounded-xl bg-teacher-deep px-4 py-2.5 text-sm font-medium text-paper-surface"
              href="/teacher/topics"
            >
              교사 화면으로 이동
            </Link>
            <Link
              className="whitespace-nowrap rounded-xl bg-paper-base px-4 py-2.5 text-sm font-medium text-ink-700"
              href="/teacher/submissions"
            >
              제출물 바로 보기
            </Link>
          </div>
        </div>

        <div className="rounded-2xl bg-paper-surface p-6 shadow-sm">
          <p className="text-sm font-semibold text-ink-500">학생 동선</p>
          <h2 className="mt-2 text-xl font-semibold">주제 선택 후 제출과 기록 확인</h2>
          <ol className="mt-4 space-y-3 text-sm text-ink-700">
            <li>1. 내 학년에 맞는 주제를 고릅니다.</li>
            <li>2. 글쓰기 사진을 업로드합니다.</li>
            <li>3. 기록 화면에서 피드백 상태를 확인합니다.</li>
          </ol>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              className="whitespace-nowrap rounded-xl bg-teacher-deep px-4 py-2.5 text-sm font-medium text-paper-surface"
              href="/student"
            >
              학생 제출하러 가기
            </Link>
            <Link
              className="whitespace-nowrap rounded-xl bg-paper-base px-4 py-2.5 text-sm font-medium text-ink-700"
              href="/student/history"
            >
              내 기록 보기
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
