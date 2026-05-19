"use client";

import { FormEvent, useState } from "react";
import { apiFetch } from "../lib/api";
import { PrimaryButton, SecondaryButton } from "./ui-v2";

export type NeisSchool = {
  officeCode: string;
  officeName: string;
  schoolCode: string;
  schoolName: string;
  schoolLevel: string | null;
  address: string | null;
  homepage: string | null;
};

type SchoolSearchResponse = {
  schools: NeisSchool[];
};

type NeisSchoolPickerProps = {
  token: string | null;
  selectedSchool: NeisSchool | null;
  onSelect: (school: NeisSchool) => void | Promise<void>;
  onClear?: () => void | Promise<void>;
  disabled?: boolean;
};

function getSchoolMeta(school: NeisSchool) {
  return [school.officeName, school.schoolLevel, school.address].filter(Boolean).join(" · ");
}

export function NeisSchoolPicker({
  token,
  selectedSchool,
  onSelect,
  onClear,
  disabled = false,
}: NeisSchoolPickerProps) {
  const [keyword, setKeyword] = useState("");
  const [schools, setSchools] = useState<NeisSchool[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextKeyword = keyword.trim();
    setMessage("");
    setError("");

    if (nextKeyword.length < 2) {
      setSchools([]);
      setError("학교명을 두 글자 이상 입력해 주세요.");
      return;
    }

    if (!token) {
      setError("로그인 정보를 확인하지 못했습니다.");
      return;
    }

    setIsSearching(true);

    try {
      const response = await apiFetch<SchoolSearchResponse>(
        `/api/public-data/neis/schools?keyword=${encodeURIComponent(nextKeyword)}`,
        { token },
      );
      setSchools(response.schools);
      setMessage(
        response.schools.length > 0
          ? `${response.schools.length}개의 학교를 찾았습니다.`
          : "검색 결과가 없습니다. 학교명을 조금 다르게 입력해 보세요.",
      );
    } catch (searchError) {
      setSchools([]);
      setError(searchError instanceof Error ? searchError.message : "학교 검색에 실패했습니다.");
    } finally {
      setIsSearching(false);
    }
  }

  return (
    <div className="rounded-xl border border-teacher-accent/20 bg-paper-surface/80 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-ink-900">공공데이터 학교 연결</p>
          <p className="kr-keep mt-1 text-xs leading-5 text-ink-600">
            학교를 연결하면 AI가 NEIS 학사일정과 학교 맥락을 참고해 글쓰기 주제를 추천해요.
          </p>
        </div>
        {selectedSchool && onClear ? (
          <SecondaryButton disabled={disabled} onClick={onClear} type="button">
            연결 해제
          </SecondaryButton>
        ) : null}
      </div>

      {selectedSchool ? (
        <div className="mt-4 rounded-lg border border-student-accent/25 bg-student-soft/60 px-4 py-3">
          <p className="text-xs font-semibold text-student-accent">연결된 학교</p>
          <p className="mt-1 text-sm font-bold text-ink-900">{selectedSchool.schoolName}</p>
          <p className="mt-1 text-xs leading-5 text-ink-600">{getSchoolMeta(selectedSchool)}</p>
        </div>
      ) : (
        <p className="mt-3 text-xs leading-5 text-ink-500">
          학교를 연결하지 않아도 학급은 만들 수 있어요.
        </p>
      )}

      <form className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]" onSubmit={handleSearch}>
        <label className="block text-sm font-semibold text-ink-700">
          학교명으로 검색
          <input
            className="mt-2 h-11 rounded-md border-ink-100 bg-paper-surface text-sm text-ink-900 placeholder:text-ink-300 focus:border-teacher-accent focus:ring-teacher-accent/20"
            disabled={disabled || isSearching}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="예: 서울초등학교"
            value={keyword}
          />
        </label>
        <PrimaryButton
          className="self-end"
          disabled={disabled || isSearching || !keyword.trim()}
          tone="teacher"
          type="submit"
        >
          {isSearching ? "검색 중..." : "검색"}
        </PrimaryButton>
      </form>

      {message ? <p className="mt-3 text-xs font-semibold text-teacher-deep">{message}</p> : null}
      {error ? <p className="mt-3 text-xs font-semibold text-status-error">{error}</p> : null}

      {schools.length > 0 ? (
        <div className="mt-3 grid gap-2">
          {schools.map((school) => {
            const isSelected =
              selectedSchool?.officeCode === school.officeCode &&
              selectedSchool?.schoolCode === school.schoolCode;

            return (
              <button
                key={`${school.officeCode}-${school.schoolCode}`}
                className={`rounded-lg border px-4 py-3 text-left text-sm transition hover:border-teacher-accent/40 hover:bg-paper-base ${
                  isSelected
                    ? "border-student-accent bg-student-soft/70"
                    : "border-ink-100 bg-paper-surface"
                }`}
                disabled={disabled}
                onClick={() => onSelect(school)}
                type="button"
              >
                <span className="block font-bold text-ink-900">{school.schoolName}</span>
                <span className="mt-1 block text-xs leading-5 text-ink-600">
                  {getSchoolMeta(school)}
                </span>
                <span className="mt-2 inline-flex rounded-full bg-teacher-soft px-3 py-1 text-xs font-semibold text-teacher-deep">
                  {isSelected ? "연결됨" : "이 학교 연결하기"}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
