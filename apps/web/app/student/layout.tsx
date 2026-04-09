"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../../components/auth-provider";

const studentLinks = [
  { href: "/student/upload", label: "Writing Submission" },
  { href: "/student/history", label: "My History" },
];

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, isReady } = useAuth();

  if (!isReady || user?.role !== "STUDENT") {
    return <>{children}</>;
  }

  return (
    <div className="grid gap-6 md:grid-cols-[240px_1fr]">
      <aside className="rounded-2xl bg-white p-4 shadow-sm">
        <p className="px-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          Student Menu
        </p>
        <nav className="mt-3 space-y-2">
          {studentLinks.map((link) => (
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
          Submit writing and check your submission history from one student workspace.
        </div>
      </aside>
      <div>{children}</div>
    </div>
  );
}
