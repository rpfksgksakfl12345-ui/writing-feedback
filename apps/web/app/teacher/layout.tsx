"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../../components/auth-provider";

const teacherLinks = [
  { href: "/teacher/topics", label: "Topic Management" },
  { href: "/teacher/submissions", label: "Submission Review" },
];

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, isReady } = useAuth();

  if (!isReady || user?.role !== "TEACHER") {
    return <>{children}</>;
  }

  return (
    <div className="grid gap-6 md:grid-cols-[240px_1fr]">
      <aside className="rounded-2xl bg-white p-4 shadow-sm">
        <p className="px-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          Teacher Menu
        </p>
        <nav className="mt-3 space-y-2">
          {teacherLinks.map((link) => (
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
          Create topics, review submissions, and prepare feedback from one teacher workspace.
        </div>
      </aside>
      <div>{children}</div>
    </div>
  );
}
