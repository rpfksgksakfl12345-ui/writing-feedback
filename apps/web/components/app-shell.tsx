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
    <div className="min-h-screen bg-paper-base">
      <header className="border-b border-[#E8DEC7] bg-[#FFFAF0]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link
            href={getHomeHref(user?.role)}
            className={`inline-flex justify-center text-center text-lg font-semibold tracking-tight text-[#2E2A24] ${brandWidthClass}`}
          >
            주제 글쓰기
          </Link>
          <div className="flex items-center gap-3 text-sm">
            {isReady && user ? (
              <>
                <span className="hidden text-[#5A5247] sm:inline">{user.name}</span>
                <span className="whitespace-nowrap rounded-full bg-paper-base px-3 py-1 font-medium text-[#5A5247]">
                  {roleLabel}
                </span>
                <button
                  className="whitespace-nowrap bg-transparent px-0 py-0 text-[#8B8170] hover:bg-transparent hover:text-[#2E2A24]"
                  onClick={handleLogout}
                >
                  로그아웃
                </button>
              </>
            ) : (
              <Link className="whitespace-nowrap rounded-xl bg-teacher-accent px-3 py-2 text-white hover:bg-teacher-accent/90" href="/login">
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
