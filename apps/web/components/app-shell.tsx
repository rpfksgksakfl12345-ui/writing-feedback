"use client";

import Link from "next/link";
import { useAuth } from "./auth-provider";

function getHomeHref(role?: "TEACHER" | "STUDENT") {
  if (role === "TEACHER") {
    return "/teacher/topics";
  }

  if (role === "STUDENT") {
    return "/student/upload";
  }

  return "/";
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout, isReady } = useAuth();
  const roleLabel = user?.role === "TEACHER" ? "Teacher" : "Student";

  return (
    <div className="min-h-screen bg-paper-base">
      <header className="border-b border-[#E8DEC7] bg-[#FFFAF0]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href={getHomeHref(user?.role)} className="text-lg font-semibold tracking-tight text-[#2E2A24]">
            Writing Feedback MVP
          </Link>
          <div className="flex items-center gap-3 text-sm">
            {isReady && user ? (
              <>
                <span className="hidden text-[#5A5247] sm:inline">{user.name}</span>
                <span className="rounded-full bg-paper-base px-3 py-1 font-medium text-[#5A5247]">
                  {roleLabel}
                </span>
                <button
                  className="bg-transparent px-0 py-0 text-[#8B8170] hover:bg-transparent hover:text-[#2E2A24]"
                  onClick={logout}
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link className="rounded-xl bg-teacher-accent px-3 py-2 text-white hover:bg-teacher-accent/90" href="/login">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
