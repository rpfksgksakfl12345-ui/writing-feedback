"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../../components/auth-provider";

const teacherLinks = [
  { href: "/teacher/classrooms", label: "학급 관리" },
  { href: "/teacher/topics", label: "주제 관리" },
  { href: "/teacher/submissions", label: "제출 글" },
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
      <section className="rounded-xl border border-[#E8DEC7] bg-[#FFFAF0] p-6 text-[#5A5247] shadow-sm">
        로그인 화면으로 이동 중입니다...
      </section>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-[240px_1fr]">
      <aside className="rounded-[24px] border border-[#E8DEC7] bg-[#FFFAF0] p-4 shadow-sm">
        <p className="px-3 text-xs font-semibold uppercase tracking-[0.18em] text-teacher-accent">
          교사 메뉴
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
                    ? "bg-teacher-accent text-white shadow-sm"
                    : "bg-paper-base text-[#5A5247] hover:bg-paper-base/70"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-6 rounded-2xl border border-[#E8DEC7] bg-paper-base/70 p-4 text-sm leading-6 text-[#5A5247]">
          학급을 만들고 주제를 준비한 뒤 학생 제출 글에 피드백을 남깁니다.
        </div>
      </aside>
      <div>{children}</div>
    </div>
  );
}
