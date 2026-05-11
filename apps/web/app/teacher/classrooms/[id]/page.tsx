"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { NoticeBanner } from "../../../../components/notice-banner";
import { useAuth } from "../../../../components/auth-provider";
import { Badge, PrimaryButton, SecondaryButton } from "../../../../components/ui-v2";
import { apiFetch } from "../../../../lib/api";

type Classroom = {
  id: number;
  name: string;
  grade: number;
  classCode: string;
  createdAt: string;
};

type ClassroomStudent = {
  id: number;
  userId: number;
  name: string;
  grade: number | null;
  studentNumber: number;
  classroomLoginPassword: string;
  createdAt: string;
};

type BulkStudentRow = {
  rowId: string;
  name: string;
  studentNumber: string;
};

function createEmptyBulkRow(rowId = "bulk-1"): BulkStudentRow {
  return {
    rowId,
    name: "",
    studentNumber: "",
  };
}

function formatDate(createdAt: string) {
  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    return "날짜 정보 없음";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
  }).format(date);
}

function getStudentLabel(student: Pick<ClassroomStudent, "name" | "studentNumber">) {
  return student.name || `${student.studentNumber}번 학생`;
}

export default function TeacherClassroomDetailPage() {
  const params = useParams<{ id: string }>();
  const classroomId = Number(params.id);
  const { token, user, isReady } = useAuth();
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [students, setStudents] = useState<ClassroomStudent[]>([]);
  const [name, setName] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [classroomLoginPassword, setClassroomLoginPassword] = useState("");
  const [bulkRows, setBulkRows] = useState<BulkStudentRow[]>([createEmptyBulkRow()]);
  const [message, setMessage] = useState("");
  const [bulkMessage, setBulkMessage] = useState("");
  const [error, setError] = useState("");
  const [bulkError, setBulkError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isBulkSaving, setIsBulkSaving] = useState(false);

  const classroom = useMemo(
    () => classrooms.find((item) => item.id === classroomId) ?? null,
    [classroomId, classrooms],
  );

  async function loadClassroomData() {
    if (!token || !Number.isInteger(classroomId) || classroomId < 1) {
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const nextClassrooms = await apiFetch<Classroom[]>("/api/classrooms", { token });
      setClassrooms(nextClassrooms);

      if (nextClassrooms.some((item) => item.id === classroomId)) {
        const nextStudents = await apiFetch<ClassroomStudent[]>(
          `/api/classrooms/${classroomId}/students`,
          { token },
        );
        setStudents(nextStudents);
      } else {
        setStudents([]);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "학급 정보를 불러오지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadClassroomData();
  }, [classroomId, token]);

  useEffect(() => {
    function clearPrintMode() {
      document.body.removeAttribute("data-print-mode");
    }

    window.addEventListener("afterprint", clearPrintMode);

    return () => {
      window.removeEventListener("afterprint", clearPrintMode);
      clearPrintMode();
    };
  }, []);

  async function handleCreateStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    setIsSaving(true);

    try {
      const body: {
        name: string;
        studentNumber: number;
        classroomLoginPassword?: string;
      } = {
        name,
        studentNumber: Number(studentNumber),
      };

      if (classroomLoginPassword.trim()) {
        body.classroomLoginPassword = classroomLoginPassword.trim();
      }

      const student = await apiFetch<ClassroomStudent>(`/api/classrooms/${classroomId}/students`, {
        method: "POST",
        token,
        body: JSON.stringify(body),
      });

      setName("");
      setStudentNumber("");
      setClassroomLoginPassword("");
      setMessage(`${student.name} 학생이 발급되었습니다. 번호 ${student.studentNumber}`);
      await loadClassroomData();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "학생을 발급하지 못했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  function updateBulkRow(rowId: string, field: keyof Omit<BulkStudentRow, "rowId">, value: string) {
    setBulkRows((currentRows) =>
      currentRows.map((row) => (row.rowId === rowId ? { ...row, [field]: value } : row)),
    );
  }

  function addBulkRow() {
    setBulkRows((currentRows) => [
      ...currentRows,
      createEmptyBulkRow(`bulk-${Date.now()}-${currentRows.length}`),
    ]);
  }

  function removeBulkRow(rowId: string) {
    setBulkRows((currentRows) => {
      if (currentRows.length === 1) {
        return [createEmptyBulkRow(currentRows[0].rowId)];
      }

      return currentRows.filter((row) => row.rowId !== rowId);
    });
  }

  async function handleBulkCreateStudents(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBulkMessage("");
    setBulkError("");

    const preparedRows = bulkRows.map((row, index) => ({
      ...row,
      displayIndex: index + 1,
      name: row.name.trim(),
      studentNumberValue: Number(row.studentNumber),
    }));
    const invalidRows = preparedRows.filter(
      (row) => !row.name || !Number.isInteger(row.studentNumberValue) || row.studentNumberValue < 1,
    );

    if (invalidRows.length > 0) {
      setBulkError("단체 발급 행마다 학생 이름과 1 이상의 번호를 입력해 주세요.");
      return;
    }

    setIsBulkSaving(true);

    const successes: ClassroomStudent[] = [];
    const failures: Array<{ row: BulkStudentRow; reason: string; label: string }> = [];

    for (const row of preparedRows) {
      try {
        const body: {
          name: string;
          studentNumber: number;
        } = {
          name: row.name,
          studentNumber: row.studentNumberValue,
        };

        const student = await apiFetch<ClassroomStudent>(`/api/classrooms/${classroomId}/students`, {
          method: "POST",
          token,
          body: JSON.stringify(body),
        });
        successes.push(student);
      } catch (createError) {
        failures.push({
          row,
          label: `${row.displayIndex}행 ${row.name || row.studentNumber || "학생"}`,
          reason: createError instanceof Error ? createError.message : "발급 실패",
        });
      }
    }

    if (successes.length > 0) {
      setBulkMessage(`${successes.length}명의 학생을 발급했습니다.`);
      await loadClassroomData();
    }

    if (failures.length > 0) {
      setBulkError(failures.map((failure) => `${failure.label}: ${failure.reason}`).join("\n"));
      setBulkRows(
        failures.map((failure, index) => ({
          ...failure.row,
          rowId: `bulk-failed-${Date.now()}-${index}`,
        })),
      );
    } else {
      setBulkRows([createEmptyBulkRow()]);
    }

    setIsBulkSaving(false);
  }

  function handlePrintRoster() {
    document.body.setAttribute("data-print-mode", "roster");
    window.print();
  }

  function handlePrintLoginCards() {
    document.body.setAttribute("data-print-mode", "labels");
    window.print();
  }

  if (isReady && user?.role !== "TEACHER") {
    return (
      <section className="rounded-xl border border-ink-100 bg-paper-surface p-6 text-ink-700 shadow-sm">
        교사 계정만 접근할 수 있습니다.
      </section>
    );
  }

  if (!Number.isInteger(classroomId) || classroomId < 1) {
    return (
      <section className="rounded-xl border border-ink-100 bg-paper-surface p-6 text-ink-700 shadow-sm">
        올바른 학급 주소가 아닙니다.
      </section>
    );
  }

  if (!isLoading && !classroom) {
    return (
      <section className="rounded-xl border border-ink-100 bg-paper-surface p-6 shadow-sm">
        <p className="text-lg font-semibold text-ink-900">학급을 찾을 수 없습니다.</p>
        <p className="mt-2 text-sm text-ink-700">
          현재 교사 계정에 연결된 학급 목록에서 이 학급을 찾지 못했습니다.
        </p>
        <Link
          className="mt-5 inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-md bg-teacher-accent px-[18px] py-[13px] text-[15px] font-semibold text-paper-surface hover:bg-teacher-accent/90"
          href="/teacher/classrooms"
        >
          학급 목록으로 돌아가기
        </Link>
      </section>
    );
  }

  return (
    <div className="overflow-hidden rounded-[28px] border border-ink-100 bg-paper-soft shadow-[0_1px_2px_rgba(60,40,20,.06),0_14px_34px_rgba(60,40,20,.08)]">
      <section className="bg-paper-surface bg-[radial-gradient(rgba(90,110,133,.07)_1px,transparent_1px)] bg-[length:24px_24px] px-8 pb-7 pt-8">
        <Link
          className="inline-flex min-h-9 items-center whitespace-nowrap rounded-md border border-ink-100 bg-paper-surface px-3 text-sm font-semibold text-ink-700 hover:bg-paper-base"
          href="/teacher/classrooms"
        >
          학급 목록
        </Link>
        <div className="mt-5 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-sm font-semibold text-teacher-accent">학급 관리</p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-ink-900">
              {classroom?.name ?? "학급을 불러오는 중"}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-700">
              학생을 발급하고 학급코드, 번호, 로그인 비밀번호를 확인합니다.
            </p>
          </div>

          <div className="grid min-w-[300px] gap-3 rounded-xl border border-ink-100 bg-paper-surface/85 p-4 shadow-sm">
            <div>
              <p className="text-xs text-ink-500">학년</p>
              <p className="mt-1 text-lg font-semibold text-ink-900">
                {classroom ? `${classroom.grade}학년` : "-"}
              </p>
            </div>
            <div className="rounded-xl border border-teacher-accent/25 bg-teacher-soft/70 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teacher-deep">학급코드</p>
              <p className="mt-2 font-mono text-3xl font-bold tracking-[0.14em] text-teacher-accent">
                {classroom?.classCode ?? "-"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 px-8 pb-10 pt-7">
        <div className="grid gap-6 xl:grid-cols-2">
          <section className="h-fit rounded-xl border border-teacher-accent/20 bg-paper-surface p-5 shadow-sm">
            <div className="mb-4 h-1.5 rounded-full bg-teacher-accent/70" />
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-500">
              단건 발급
            </p>
            <h2 className="mt-1 text-xl font-bold text-ink-900">학생 한 명 발급</h2>
            <p className="mt-2 text-sm leading-6 text-ink-700">
              로그인 비밀번호를 비워두면 자동 생성됩니다.
            </p>

            <form className="mt-5 space-y-4" onSubmit={handleCreateStudent}>
              <label className="block text-sm font-semibold text-ink-700">
                학생 이름
                <input
                  className="mt-2 h-11 rounded-md border-ink-100 bg-paper-surface text-sm text-ink-900 placeholder:text-ink-300 focus:border-teacher-accent focus:ring-teacher-accent/20"
                  placeholder="예: 김하늘"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>

              <label className="block text-sm font-semibold text-ink-700">
                번호
                <input
                  className="mt-2 h-11 rounded-md border-ink-100 bg-paper-surface text-sm text-ink-900 focus:border-teacher-accent focus:ring-teacher-accent/20"
                  value={studentNumber}
                  onChange={(event) => setStudentNumber(event.target.value)}
                  inputMode="numeric"
                />
              </label>

              <label className="block text-sm font-semibold text-ink-700">
                로그인 비밀번호
                <input
                  className="mt-2 h-11 rounded-md border-ink-100 bg-paper-surface text-sm text-ink-900 placeholder:text-ink-300 focus:border-teacher-accent focus:ring-teacher-accent/20"
                  placeholder="비워두면 자동 생성"
                  value={classroomLoginPassword}
                  onChange={(event) => setClassroomLoginPassword(event.target.value)}
                />
              </label>

              {message ? <NoticeBanner tone="success" title="학생 발급 완료" description={message} /> : null}
              {error ? <NoticeBanner tone="error" title="학생 처리 실패" description={error} /> : null}

              <div className="flex justify-end">
                <PrimaryButton disabled={isSaving || !classroom} tone="teacher" type="submit">
                  {isSaving ? "발급 중..." : "학생 발급"}
                </PrimaryButton>
              </div>
            </form>
          </section>

          <section className="h-fit rounded-xl border border-dashed border-teacher-accent/30 bg-paper-soft/75 p-5 shadow-sm">
            <div className="mb-4 h-1.5 rounded-full bg-student-accent/70" />
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-500">
              단체 발급
            </p>
            <h2 className="mt-1 text-xl font-bold text-ink-900">여러 학생 한 번에 발급</h2>
            <p className="mt-2 text-sm leading-6 text-ink-700">
              행을 추가해 여러 명을 입력합니다. 로그인 비밀번호는 자동으로 만들어집니다.
            </p>

            <form className="mt-5 space-y-4" onSubmit={handleBulkCreateStudents}>
              <div className="space-y-3">
                {bulkRows.map((row) => (
                  <div
                    key={row.rowId}
                    className="grid grid-cols-[76px_minmax(0,1fr)_56px] items-end gap-2 rounded-lg border border-ink-100 bg-paper-surface p-3 shadow-sm"
                  >
                    <label className="block min-w-0 text-sm font-semibold text-ink-700">
                      번호
                      <input
                        className="mt-2 h-10 rounded-md border-ink-100 bg-paper-surface text-sm text-ink-900 focus:border-teacher-accent focus:ring-teacher-accent/20"
                        placeholder="예: 7"
                        value={row.studentNumber}
                        onChange={(event) => updateBulkRow(row.rowId, "studentNumber", event.target.value)}
                        inputMode="numeric"
                      />
                    </label>
                    <label className="block min-w-0 text-sm font-semibold text-ink-700">
                      학생 이름
                      <input
                        className="mt-2 h-10 rounded-md border-ink-100 bg-paper-surface text-sm text-ink-900 focus:border-teacher-accent focus:ring-teacher-accent/20"
                        placeholder="예: 김하늘"
                        value={row.name}
                        onChange={(event) => updateBulkRow(row.rowId, "name", event.target.value)}
                      />
                    </label>
                    <SecondaryButton
                      className="h-10 min-h-10 w-14 whitespace-nowrap px-0 py-0 text-sm"
                      type="button"
                      onClick={() => removeBulkRow(row.rowId)}
                    >
                      삭제
                    </SecondaryButton>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <SecondaryButton type="button" onClick={addBulkRow}>
                  행 추가
                </SecondaryButton>
                <PrimaryButton disabled={isBulkSaving || !classroom} tone="teacher" type="submit">
                  {isBulkSaving ? "발급 중..." : "입력한 학생 발급"}
                </PrimaryButton>
              </div>

              {bulkMessage ? <NoticeBanner tone="success" title="단체 발급 완료" description={bulkMessage} /> : null}
              {bulkError ? (
                <NoticeBanner
                  tone="error"
                  title="단체 발급 확인 필요"
                  description={bulkError}
                />
              ) : null}
            </form>
          </section>
        </div>

        <section className="print-roster-area rounded-xl border border-ink-100 bg-paper-surface p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-500">
                  학생 명단
                </p>
                <h2 className="mt-1 text-xl font-bold text-ink-900">발급된 학생과 로그인 정보</h2>
                <p className="mt-2 text-sm leading-6 text-ink-700">
                  학생에게는 학급코드, 번호, 로그인 비밀번호만 안내하면 됩니다.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Badge tone="teacher">{students.length}명</Badge>
                <SecondaryButton
                  className="no-print"
                  disabled={students.length === 0}
                  onClick={handlePrintRoster}
                  type="button"
                >
                  학생 명단 출력
                </SecondaryButton>
              </div>
            </div>

            {isLoading ? (
              <div className="mt-5 rounded-xl border border-dashed border-ink-200 bg-paper-base/60 px-6 py-12 text-center text-sm text-ink-500">
                학생 명단을 불러오는 중입니다...
              </div>
            ) : null}

            {!isLoading && students.length === 0 ? (
              <div className="mt-5 rounded-xl border border-dashed border-ink-200 bg-paper-base/60 px-6 py-12 text-center">
                <p className="text-lg font-semibold text-ink-900">아직 학생이 없습니다.</p>
                <p className="mt-2 text-sm text-ink-700">
                  학생을 발급하면 이곳에서 로그인 정보를 확인할 수 있습니다.
                </p>
              </div>
            ) : null}

            {!isLoading && students.length > 0 ? (
              <div className="print-roster-table-wrap mt-5 overflow-x-auto rounded-xl border border-ink-100 bg-paper-base/35">
                <table className="w-full min-w-[640px] table-fixed border-collapse text-left text-sm">
                  <thead className="bg-paper-base text-xs font-semibold uppercase tracking-[0.12em] text-ink-500">
                    <tr>
                      <th className="w-[90px] px-4 py-3">번호</th>
                      <th className="w-[160px] px-4 py-3">학생 이름</th>
                      <th className="w-[150px] px-4 py-3">학급코드</th>
                      <th className="w-[170px] px-4 py-3">로그인 비밀번호</th>
                      <th className="w-[140px] px-4 py-3">발급일</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100 bg-paper-surface text-ink-900">
                    {students.map((student) => (
                      <tr key={student.id} className="transition hover:bg-paper-base/60">
                        <td className="whitespace-nowrap px-4 py-4 font-semibold">
                          {student.studentNumber}번
                        </td>
                        <td className="px-4 py-4 font-semibold">{getStudentLabel(student)}</td>
                        <td className="whitespace-nowrap px-4 py-4 font-mono font-bold tracking-[0.12em] text-teacher-accent">
                          {classroom?.classCode ?? "-"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4">
                          <span className="rounded-md border border-feedback-pen/20 bg-feedback-soft px-2 py-1 font-mono font-bold text-feedback-pen">
                            {student.classroomLoginPassword}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-ink-700">
                          {formatDate(student.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
        </section>

        {classroom && !isLoading && students.length > 0 ? (
          <section className="print-label-area rounded-xl border border-ink-100 bg-paper-surface p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-500">
                    로그인 안내 카드
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-ink-900">학생에게 나눠줄 정보</h2>
                  <p className="mt-2 text-sm leading-6 text-ink-700">
                    A4 라벨지처럼 잘라 나눠줄 수 있는 로그인 안내 카드입니다.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Badge tone="teacher">{students.length}장</Badge>
                  <PrimaryButton
                    className="no-print"
                    disabled={students.length === 0}
                    onClick={handlePrintLoginCards}
                    tone="teacher"
                    type="button"
                  >
                    로그인 안내 카드 출력
                  </PrimaryButton>
                </div>
              </div>

              <div className="print-label-grid mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {students.map((student) => (
                  <article
                    className="print-label-card break-inside-avoid rounded-xl border border-ink-100 bg-paper-base p-5 shadow-sm"
                    key={`login-card-${student.id}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-500">
                          주제 글쓰기
                        </p>
                        <h3 className="mt-2 text-xl font-bold text-ink-900">
                          {getStudentLabel(student)}
                        </h3>
                      </div>
                      <Badge tone="teacher">{student.studentNumber}번</Badge>
                    </div>

                    <div className="mt-5 grid gap-3 text-sm">
                      <div className="rounded-lg border border-ink-100 bg-paper-surface px-3 py-2">
                        <p className="text-xs text-ink-500">학급코드</p>
                        <p className="mt-1 font-mono text-lg font-bold tracking-[0.14em] text-teacher-accent">
                          {classroom.classCode}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg border border-ink-100 bg-paper-surface px-3 py-2">
                          <p className="text-xs text-ink-500">번호</p>
                          <p className="mt-1 text-lg font-bold text-ink-900">{student.studentNumber}</p>
                        </div>
                        <div className="rounded-lg border border-ink-100 bg-paper-surface px-3 py-2">
                          <p className="text-xs text-ink-500">비밀번호</p>
                          <p className="mt-1 font-mono text-lg font-bold text-ink-900">
                            {student.classroomLoginPassword}
                          </p>
                        </div>
                      </div>
                    </div>

                    <p className="mt-4 rounded-lg bg-paper-sunk px-3 py-2 text-xs leading-5 text-ink-700">
                      학생 로그인에서 학급 코드, 번호, 로그인 비밀번호를 입력하세요. 비밀번호를 잊었다면 담임 선생님께 물어보세요.
                    </p>
                  </article>
                ))}
              </div>
          </section>
        ) : null}
      </section>
    </div>
  );
}
