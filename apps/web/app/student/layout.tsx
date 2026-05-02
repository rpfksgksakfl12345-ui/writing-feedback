"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../../components/auth-provider";

const studentLinks = [
  { href: "/student", label: "내 글쓰기 책장" },
  { href: "/student/upload", label: "글쓰기 제출" },
  { href: "/student/history", label: "제출 기록" },
];

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, isReady } = useAuth();

  if (!isReady || user?.role !== "STUDENT") {
    return <>{children}</>;
  }

  return (
    <div className="grid gap-6 md:grid-cols-[260px_1fr]">
      <aside className="rounded-[24px] border border-[#E8DEC7] bg-[#FFFAF0] p-4 shadow-sm">
        <p className="px-3 text-xs font-semibold uppercase tracking-[0.2em] text-student-accent">
          My Shelf
        </p>
        <nav className="mt-3 space-y-2">
          {studentLinks.map((link) => {
            const isActive = pathname === link.href;

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`block rounded-2xl px-4 py-3 text-sm font-medium transition ${
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
        <div className="mt-6 rounded-2xl border border-[#E8DEC7] bg-paper-base/70 p-4 text-sm leading-6 text-[#5A5247]">
          교사가 낸 주제를 책장처럼 모아 보고, 같은 화면에서 작성 시작과 제출 기록 확인까지 이어갈 수
          있습니다.
        </div>
      </aside>
      <div>{children}</div>
    </div>
  );
}
