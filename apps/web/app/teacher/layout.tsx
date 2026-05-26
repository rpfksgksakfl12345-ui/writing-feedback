"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../../components/auth-provider";

const teacherLinks = [
  { href: "/teacher/classrooms", label: "우리 반 관리" },
  { href: "/teacher/topics", label: "우리 반 주제" },
  { href: "/teacher/submissions", label: "확인할 글" },
];

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isReady } = useAuth();

  useEffect(() => {
    if (isReady && user?.role !== "TEACHER") {
      router.replace("/login");
    }
  }, [isReady, router, user?.role]);

  if (!isReady || user?.role !== "TEACHER") {
    return (
      <section className="rounded-xl border border-ink-100 bg-paper-surface p-6 text-ink-700 shadow-sm">
        로그인 화면으로 이동 중입니다...
      </section>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-[240px_1fr]">
      <aside className="rounded-[24px] border border-ink-100 bg-paper-surface/95 p-4 shadow-[0_1px_2px_rgba(60,40,20,.05),0_10px_26px_rgba(60,40,20,.07)]">
        <p className="px-3 text-xs font-semibold uppercase tracking-[0.18em] text-teacher-accent">
          담임 메뉴
        </p>
        <nav className="mt-3 space-y-2">
          {teacherLinks.map((link) => {
            const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`block whitespace-nowrap rounded-2xl px-4 py-3 text-sm font-medium transition ${
                  isActive
                    ? "bg-teacher-accent text-paper-surface shadow-sm"
                    : "bg-paper-base text-ink-700 hover:bg-paper-base/70"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-6 rounded-2xl border border-ink-100 bg-paper-base/70 p-4 text-sm leading-6 text-ink-700">
          공책 사진 제출, 글 확인, AI 초안, 담임 피드백 순서로 우리 반 글쓰기를 정리합니다.
        </div>
      </aside>
      <div>{children}</div>
    </div>
  );
}
