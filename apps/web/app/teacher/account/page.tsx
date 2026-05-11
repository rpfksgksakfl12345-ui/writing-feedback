"use client";

import { FormEvent, useState } from "react";
import { NoticeBanner } from "../../../components/notice-banner";
import { useAuth } from "../../../components/auth-provider";
import { PrimaryButton, PaperCard } from "../../../components/ui-v2";
import { apiFetch } from "../../../lib/api";

type ChangePasswordResponse = {
  message: string;
};

export default function TeacherAccountPage() {
  const { token, user, isReady } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function handleChangePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (newPassword !== newPasswordConfirm) {
      setError("새 비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    setIsSaving(true);

    try {
      const response = await apiFetch<ChangePasswordResponse>("/api/auth/password", {
        method: "PATCH",
        token,
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      setCurrentPassword("");
      setNewPassword("");
      setNewPasswordConfirm("");
      setMessage(response.message || "비밀번호를 바꿨어요.");
    } catch (changeError) {
      setError(
        changeError instanceof Error ? changeError.message : "비밀번호를 바꾸지 못했습니다.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (isReady && user?.role !== "TEACHER") {
    return (
      <PaperCard className="text-ink-700">
        <p>교사 계정만 접근할 수 있습니다.</p>
      </PaperCard>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PaperCard>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-500">
          계정 설정
        </p>
        <h1 className="mt-2 text-2xl font-bold text-ink-900">내 비밀번호 바꾸기</h1>
        <p className="mt-2 text-sm leading-6 text-ink-700">
          현재 비밀번호를 확인한 뒤 새 비밀번호로 바꿀 수 있어요.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleChangePassword}>
          <label className="block text-sm font-semibold text-ink-700">
            현재 비밀번호
            <input
              className="mt-2 h-11 rounded-md border-ink-100 bg-paper-surface text-sm text-ink-900 placeholder:text-ink-300 focus:border-teacher-accent focus:ring-teacher-accent/20"
              autoComplete="current-password"
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </label>

          <label className="block text-sm font-semibold text-ink-700">
            새 비밀번호
            <input
              className="mt-2 h-11 rounded-md border-ink-100 bg-paper-surface text-sm text-ink-900 placeholder:text-ink-300 focus:border-teacher-accent focus:ring-teacher-accent/20"
              autoComplete="new-password"
              minLength={8}
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </label>

          <label className="block text-sm font-semibold text-ink-700">
            새 비밀번호 확인
            <input
              className="mt-2 h-11 rounded-md border-ink-100 bg-paper-surface text-sm text-ink-900 placeholder:text-ink-300 focus:border-teacher-accent focus:ring-teacher-accent/20"
              autoComplete="new-password"
              minLength={8}
              type="password"
              value={newPasswordConfirm}
              onChange={(event) => setNewPasswordConfirm(event.target.value)}
            />
          </label>

          {message ? (
            <NoticeBanner tone="success" title="변경 완료" description={message} />
          ) : null}
          {error ? <NoticeBanner tone="error" title="변경 실패" description={error} /> : null}

          <div className="flex justify-end">
            <PrimaryButton disabled={isSaving || !token} tone="teacher" type="submit">
              {isSaving ? "변경 중..." : "비밀번호 바꾸기"}
            </PrimaryButton>
          </div>
        </form>
      </PaperCard>
    </div>
  );
}
