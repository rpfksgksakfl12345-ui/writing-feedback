"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "./auth-provider";

function getHomeHref(role?: "TEACHER" | "STUDENT") {
  if (role === "TEACHER") {
    return "/teacher/topics";
  }

  if (role === "STUDENT") {
    return "/student";
  }

  return "/";
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout, isReady } = useAuth();
  const router = useRouter();
  const roleLabel = user?.role === "TEACHER" ? "담임" : "학생";

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  return (
    <div className="min-h-screen bg-paper-soft">
      <header className="border-b border-ink-100 bg-paper-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link
            href={getHomeHref(user?.role)}
            className="inline-flex min-w-0 items-center gap-2 text-left text-ink-900"
          >
            <span
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-student-accent/25 bg-student-soft"
            >
              <span className="relative h-5 w-5 rounded-md border border-student-accent/30 bg-paper-surface">
                <span className="absolute left-1 right-1 top-1.5 h-px bg-student-accent/30" />
                <span className="absolute left-1 right-1 top-3 h-px bg-student-accent/30" />
                <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-student-accent" />
              </span>
            </span>
            <span className="min-w-0">
              <span className="font-brand-logo block text-xl font-bold leading-5">공책톡톡</span>
              <span className="hidden text-[11px] font-medium leading-4 text-ink-500 sm:block">
                공책 사진부터 담임 피드백까지
              </span>
            </span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            {isReady && user ? (
              <>
                <span className="hidden text-ink-700 sm:inline">{user.name}</span>
                <span className="whitespace-nowrap rounded-full bg-paper-base px-3 py-1 font-medium text-ink-700">
                  {roleLabel}
                </span>
                {user.role === "TEACHER" ? (
                  <Link
                    className="whitespace-nowrap text-ink-500 hover:text-ink-900"
                    href="/teacher/account"
                  >
                    내 계정
                  </Link>
                ) : null}
                <button
                  className="whitespace-nowrap bg-transparent px-0 py-0 text-ink-500 hover:bg-transparent hover:text-ink-900"
                  onClick={handleLogout}
                >
                  로그아웃
                </button>
              </>
            ) : (
              <Link className="hidden whitespace-nowrap rounded-xl bg-teacher-accent px-3 py-2 text-paper-surface hover:bg-teacher-accent/90 sm:inline-block" href="/login">
                우리 반 들어가기
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl overflow-x-hidden px-4 py-6">{children}</main>
    </div>
  );
}
