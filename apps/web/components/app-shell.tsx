"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./auth-provider";

const links = [
  { href: "/teacher/topics", label: "교사 주제", role: "TEACHER" },
  { href: "/teacher/submissions", label: "교사 제출물", role: "TEACHER" },
  { href: "/student/upload", label: "학생 업로드", role: "STUDENT" },
  { href: "/student/history", label: "학생 기록", role: "STUDENT" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout, isReady } = useAuth();
  const isAuthPage = pathname === "/login";
  const roleLabel = user?.role === "TEACHER" ? "교사" : "학생";
  const visibleLinks = links.filter((link) => user?.role === link.role);

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-lg font-semibold tracking-tight text-slate-900">
            글쓰기 피드백 MVP
          </Link>
          <div className="flex items-center gap-3 text-sm">
            {isReady && user ? (
              <>
                <span className="hidden text-slate-600 sm:inline">{user.name}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
                  {roleLabel}
                </span>
                <button
                  className="bg-transparent px-0 py-0 text-slate-500 hover:bg-transparent hover:text-slate-900"
                  onClick={logout}
                >
                  로그아웃
                </button>
              </>
            ) : (
              <Link className="rounded-xl bg-slate-900 px-3 py-2 text-white" href="/login">
                체험 계정 로그인
              </Link>
            )}
          </div>
        </div>
      </header>

      <div
        className={`mx-auto max-w-6xl gap-6 px-4 py-6 ${
          user && !isAuthPage ? "grid md:grid-cols-[240px_1fr]" : ""
        }`}
      >
        {user && !isAuthPage ? (
          <aside className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="px-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              {roleLabel} 메뉴
            </p>
            <nav className="mt-3 space-y-2">
              {visibleLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`block rounded-xl px-3 py-3 text-sm font-medium ${
                    pathname === link.href
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="mt-6 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
              {user.role === "TEACHER"
                ? "주제 생성 후 제출물 목록에서 피드백을 저장하면 다시 목록으로 이동합니다."
                : "주제를 선택해 제출한 뒤, 기록 화면에서 피드백 상태를 확인할 수 있습니다."}
            </div>
          </aside>
        ) : null}
        <main>{children}</main>
      </div>
    </div>
  );
}
