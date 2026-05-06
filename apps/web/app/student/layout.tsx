"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../../components/auth-provider";

const studentLinks = [
  { href: "/student", label: "내 글쓰기 책장" },
  { href: "/student/history", label: "제출 기록" },
];

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isReady } = useAuth();

  useEffect(() => {
    if (isReady && user?.role !== "STUDENT") {
      router.replace("/login");
    }
  }, [isReady, router, user?.role]);

  if (!isReady || user?.role !== "STUDENT") {
    return (
      <section className="rounded-xl border border-[#E8DEC7] bg-[#FFFAF0] p-6 text-[#5A5247] shadow-sm">
        로그인 화면으로 이동 중입니다...
      </section>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-[260px_1fr]">
      <aside className="rounded-[24px] border border-[#E8DEC7] bg-[#FFFAF0] p-4 shadow-sm">
        <p className="px-3 text-xs font-semibold uppercase tracking-[0.2em] text-student-accent">
          학생 메뉴
        </p>
        <nav className="mt-3 space-y-2">
          {studentLinks.map((link) => {
            const isActive =
              pathname === link.href ||
              (link.href === "/student" && pathname.startsWith("/student/upload"));

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`block whitespace-nowrap rounded-2xl px-4 py-3 text-sm font-medium transition ${
                  isActive
                    ? "bg-student-accent text-white shadow-sm"
                    : "bg-paper-base text-[#5A5247] hover:bg-paper-base/70"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div>{children}</div>
    </div>
  );
}
