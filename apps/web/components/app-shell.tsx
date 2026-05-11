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
  const roleLabel = user?.role === "TEACHER" ? "교사" : "학생";
  const brandWidthClass =
    user?.role === "STUDENT" ? "md:w-[260px]" : user?.role === "TEACHER" ? "md:w-[240px]" : "";

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
            className={`inline-flex justify-center text-center text-lg font-semibold tracking-tight text-ink-900 ${brandWidthClass}`}
          >
            주제 글쓰기
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
              <Link className="whitespace-nowrap rounded-xl bg-teacher-accent px-3 py-2 text-paper-surface hover:bg-teacher-accent/90" href="/login">
                로그인
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
