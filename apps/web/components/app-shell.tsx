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

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-lg font-semibold">
            글쓰기 피드백 MVP
          </Link>
          <div className="flex items-center gap-3 text-sm">
            {isReady && user ? (
              <>
                <span>{user.name}</span>
                <span className="rounded bg-slate-100 px-2 py-1">{user.role}</span>
                <button onClick={logout}>로그아웃</button>
              </>
            ) : (
              <Link href="/login">로그인</Link>
            )}
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 md:grid-cols-[220px_1fr]">
        <aside className="rounded-xl bg-white p-4 shadow-sm">
          <nav className="space-y-2">
            {links
              .filter((link) => !user || user.role === link.role)
              .map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`block rounded-md px-3 py-2 text-sm ${
                    pathname === link.href ? "bg-slate-900 text-white" : "bg-slate-100"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
          </nav>
        </aside>
        <main>{children}</main>
      </div>
    </div>
  );
}
