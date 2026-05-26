"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { NoticeBanner } from "../../../../components/notice-banner";
import { useAuth } from "../../../../components/auth-provider";
import { NeisSchoolPicker, type NeisSchool } from "../../../../components/neis-school-picker";
import { Badge, PrimaryButton, SecondaryButton } from "../../../../components/ui-v2";
import { apiFetch } from "../../../../lib/api";

type Classroom = {
  id: number;
  name: string;
  grade: number;
  classCode: string;
  createdAt: string;
  neisOfficeCode: string | null;
  neisOfficeName: string | null;
  neisSchoolCode: string | null;
  neisSchoolName: string | null;
  neisSchoolLevel: string | null;
  neisSchoolAddress: string | null;
  neisSchoolHomepage: string | null;
};

type ClassroomStudent = {
  id: number;
  userId: number;
  name: string;
  grade: number | null;
  studentNumber: number;
  hasLoginPassword: boolean;
  createdAt: string;
};

type IssuedClassroomStudent = ClassroomStudent & {
  issuedLoginPassword?: string;
};

type DeleteResponse = {
  ok: boolean;
  message: string;
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

function getIssuedLoginPassword(
  student: Pick<ClassroomStudent, "id">,
  issuedLoginPasswords: Record<number, string>,
) {
  return issuedLoginPasswords[student.id] ?? "";
}

function getNeisSchoolFromClassroom(classroom: Classroom | null): NeisSchool | null {
  if (!classroom?.neisOfficeCode || !classroom.neisSchoolCode || !classroom.neisSchoolName) {
    return null;
  }

  return {
    officeCode: classroom.neisOfficeCode,
    officeName: classroom.neisOfficeName ?? "",
    schoolCode: classroom.neisSchoolCode,
    schoolName: classroom.neisSchoolName,
    schoolLevel: classroom.neisSchoolLevel,
    address: classroom.neisSchoolAddress,
    homepage: classroom.neisSchoolHomepage,
  };
}

export default function TeacherClassroomDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const classroomId = Number(params.id);
  const { token, user, isReady } = useAuth();
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [students, setStudents] = useState<ClassroomStudent[]>([]);
  const [name, setName] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [classroomLoginPassword, setClassroomLoginPassword] = useState("");
  const [bulkRows, setBulkRows] = useState<BulkStudentRow[]>([createEmptyBulkRow()]);
  const [message, setMessage] = useState("");
  const [schoolMessage, setSchoolMessage] = useState("");
  const [bulkMessage, setBulkMessage] = useState("");
  const [error, setError] = useState("");
  const [schoolError, setSchoolError] = useState("");
  const [bulkError, setBulkError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingSchool, setIsUpdatingSchool] = useState(false);
  const [isBulkSaving, setIsBulkSaving] = useState(false);
  const [issuedLoginPasswords, setIssuedLoginPasswords] = useState<Record<number, string>>({});
  const [reissuingStudentId, setReissuingStudentId] = useState<number | null>(null);
  const [deletingStudentId, setDeletingStudentId] = useState<number | null>(null);
  const [deleteStudentDraft, setDeleteStudentDraft] = useState<{
    student: ClassroomStudent;
    confirmation: string;
  } | null>(null);
  const [deleteClassroomConfirmation, setDeleteClassroomConfirmation] = useState("");
  const [isDeletingClassroom, setIsDeletingClassroom] = useState(false);

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

      const student = await apiFetch<IssuedClassroomStudent>(`/api/classrooms/${classroomId}/students`, {
        method: "POST",
        token,
        body: JSON.stringify(body),
      });

      setName("");
      setStudentNumber("");
      setClassroomLoginPassword("");
      if (student.issuedLoginPassword) {
        setIssuedLoginPasswords((current) => ({
          ...current,
          [student.id]: student.issuedLoginPassword ?? "",
        }));
      }
      setMessage(
        `${student.name} 학생을 발급했어요. 로그인 비밀번호는 지금 한 번만 확인할 수 있어요.`,
      );
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

    const successes: IssuedClassroomStudent[] = [];
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

        const student = await apiFetch<IssuedClassroomStudent>(`/api/classrooms/${classroomId}/students`, {
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
      setIssuedLoginPasswords((current) => {
        const nextPasswords = { ...current };
        for (const student of successes) {
          if (student.issuedLoginPassword) {
            nextPasswords[student.id] = student.issuedLoginPassword;
          }
        }
        return nextPasswords;
      });
      setBulkMessage(
        `${successes.length}명의 학생을 발급했어요. 로그인 비밀번호는 지금 한 번만 확인할 수 있어요.`,
      );
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

  async function handleReissueStudentPassword(student: ClassroomStudent) {
    setMessage("");
    setError("");
    setReissuingStudentId(student.id);

    try {
      const updatedStudent = await apiFetch<IssuedClassroomStudent>(
        `/api/classrooms/${classroomId}/students/${student.id}/login-password`,
        {
          method: "POST",
          token,
        },
      );

      setStudents((currentStudents) =>
        currentStudents.map((currentStudent) =>
          currentStudent.id === updatedStudent.id ? updatedStudent : currentStudent,
        ),
      );

      if (updatedStudent.issuedLoginPassword) {
        setIssuedLoginPasswords((current) => ({
          ...current,
          [updatedStudent.id]: updatedStudent.issuedLoginPassword ?? "",
        }));
      }

      setMessage(
        `${updatedStudent.name} 학생의 새 로그인 비밀번호를 발급했어요. 이전 비밀번호는 더 이상 사용할 수 없어요.`,
      );
    } catch (reissueError) {
      setError(
        reissueError instanceof Error
          ? reissueError.message
          : "로그인 비밀번호를 재발급하지 못했습니다.",
      );
    } finally {
      setReissuingStudentId(null);
    }
  }

  async function handleDeleteStudent(student: ClassroomStudent) {
    if (!token || deletingStudentId || deleteStudentDraft?.confirmation !== "삭제") {
      return;
    }

    setMessage("");
    setError("");
    setDeletingStudentId(student.id);

    try {
      const result = await apiFetch<DeleteResponse>(`/api/classrooms/${classroomId}/students/${student.id}`, {
        method: "DELETE",
        token,
      });
      setStudents((currentStudents) =>
        currentStudents.filter((currentStudent) => currentStudent.id !== student.id),
      );
      setIssuedLoginPasswords((current) => {
        const nextPasswords = { ...current };
        delete nextPasswords[student.id];
        return nextPasswords;
      });
      setDeleteStudentDraft(null);
      setMessage(result.message || `${getStudentLabel(student)} 학생 계정을 삭제했습니다.`);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "학생 계정을 삭제하지 못했습니다. 새로고침 후 다시 시도해 주세요.",
      );
    } finally {
      setDeletingStudentId(null);
    }
  }

  async function handleDeleteClassroom() {
    if (!token || !classroom || isDeletingClassroom || deleteClassroomConfirmation !== "삭제") {
      return;
    }

    setMessage("");
    setError("");
    setIsDeletingClassroom(true);

    try {
      await apiFetch<DeleteResponse>(`/api/classrooms/${classroom.id}`, {
        method: "DELETE",
        token,
      });
      router.push("/teacher/classrooms");
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "학급을 삭제하지 못했습니다. 새로고침 후 다시 시도해 주세요.",
      );
    } finally {
      setIsDeletingClassroom(false);
    }
  }

  async function handleUpdateSchool(school: NeisSchool | null) {
    setSchoolMessage("");
    setSchoolError("");
    setIsUpdatingSchool(true);

    try {
      const updatedClassroom = await apiFetch<Classroom>(`/api/classrooms/${classroomId}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ neisSchool: school }),
      });

      setClassrooms((currentClassrooms) =>
        currentClassrooms.map((currentClassroom) =>
          currentClassroom.id === updatedClassroom.id ? updatedClassroom : currentClassroom,
        ),
      );
      setSchoolMessage(
        school
          ? `${school.schoolName} 학교를 이 학급에 연결했어요.`
          : "이 학급의 학교 연결을 해제했어요.",
      );
    } catch (updateError) {
      setSchoolError(
        updateError instanceof Error
          ? updateError.message
          : "학교 연결을 변경하지 못했습니다.",
      );
    } finally {
      setIsUpdatingSchool(false);
    }
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
            <p className="text-sm font-semibold text-teacher-accent">우리 반 관리</p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-ink-900">
              {classroom?.name ?? "학급을 불러오는 중"}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-700">
              학생 계정을 발급하고 학급코드, 번호, 로그인 비밀번호를 안내 카드로 전달합니다.
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
        <section className="rounded-xl border border-teacher-accent/20 bg-paper-surface p-5 shadow-sm">
          <NeisSchoolPicker
            disabled={isUpdatingSchool || !classroom}
            onClear={() => handleUpdateSchool(null)}
            onSelect={(school) => handleUpdateSchool(school)}
            selectedSchool={getNeisSchoolFromClassroom(classroom)}
            token={token}
          />
          {schoolMessage ? (
            <div className="mt-4">
              <NoticeBanner tone="success" title="학교 연결 저장" description={schoolMessage} />
            </div>
          ) : null}
          {schoolError ? (
            <div className="mt-4">
              <NoticeBanner tone="error" title="학교 연결 실패" description={schoolError} />
            </div>
          ) : null}
        </section>

        <div className="grid gap-6 xl:grid-cols-2">
          <section className="h-fit rounded-xl border border-teacher-accent/20 bg-paper-surface p-5 shadow-sm">
            <div className="mb-4 h-1.5 rounded-full bg-teacher-accent/70" />
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-500">
              단건 발급
            </p>
            <h2 className="mt-1 text-xl font-bold text-ink-900">학생 한 명 계정 발급</h2>
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
                <span className="mt-2 block text-xs font-normal leading-5 text-ink-500">
                  로그인 비밀번호는 발급 직후 한 번만 확인할 수 있어요. 잊어버리면 새로
                  재발급해야 해요.
                </span>
              </label>

              {message ? <NoticeBanner tone="success" title="학생 발급 완료" description={message} /> : null}
              {error ? <NoticeBanner tone="error" title="학생 처리 실패" description={error} /> : null}

              <div className="flex justify-end">
                <PrimaryButton disabled={isSaving || !classroom} tone="teacher" type="submit">
                  {isSaving ? "발급 중..." : "학생 계정 발급하기"}
                </PrimaryButton>
              </div>
            </form>
          </section>

          <section className="h-fit rounded-xl border border-dashed border-teacher-accent/30 bg-paper-soft/75 p-5 shadow-sm">
            <div className="mb-4 h-1.5 rounded-full bg-student-accent/70" />
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-500">
              단체 발급
            </p>
            <h2 className="mt-1 text-xl font-bold text-ink-900">여러 학생 계정 한 번에 발급</h2>
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
                  {isBulkSaving ? "발급 중..." : "입력한 학생 계정 발급하기"}
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
                <h2 className="mt-1 text-xl font-bold text-ink-900">학생 명단과 로그인 정보</h2>
                <p className="mt-2 text-sm leading-6 text-ink-700">
                  로그인 비밀번호는 발급 직후 또는 재발급 직후에만 확인할 수 있습니다.
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
                  학생 명단 출력하기
                </SecondaryButton>
              </div>
            </div>

            {isLoading ? (
              <div className="mt-5 rounded-xl border border-dashed border-ink-200 bg-paper-base/60 px-6 py-12 text-center text-sm text-ink-500">
                학생 명단을 불러오는 중입니다...
              </div>
            ) : null}

            {deleteStudentDraft ? (
              <div className="no-print mt-5 rounded-xl border border-status-error/25 bg-status-error/5 p-4">
                <p className="text-sm font-bold text-status-error">
                  학생 계정을 완전히 삭제할까요?
                </p>
                <p className="kr-keep mt-2 text-sm leading-6 text-ink-700">
                  {getStudentLabel(deleteStudentDraft.student)} 학생의 제출 글, OCR 글,
                  피드백 기록이 함께 삭제됩니다. 삭제 후에는 복구할 수 없습니다.
                </p>
                <label className="mt-3 block text-sm font-semibold text-ink-700">
                  계속하려면 아래 칸에 ‘삭제’를 입력해 주세요.
                  <input
                    className="mt-2 h-10 rounded-md border-ink-100 bg-paper-surface text-sm text-ink-900 placeholder:text-ink-300 focus:border-status-error focus:ring-status-error/20"
                    value={deleteStudentDraft.confirmation}
                    onChange={(event) =>
                      setDeleteStudentDraft({
                        student: deleteStudentDraft.student,
                        confirmation: event.target.value,
                      })
                    }
                    placeholder="삭제"
                  />
                </label>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <SecondaryButton
                    className="h-10 min-h-10"
                    onClick={() => setDeleteStudentDraft(null)}
                    type="button"
                  >
                    취소
                  </SecondaryButton>
                  <button
                    className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-md border border-status-error/30 bg-status-error px-4 text-sm font-semibold text-paper-surface hover:bg-status-error/90 disabled:cursor-not-allowed disabled:border-ink-100 disabled:bg-ink-200"
                    disabled={
                      deleteStudentDraft.confirmation !== "삭제" ||
                      deletingStudentId === deleteStudentDraft.student.id
                    }
                    onClick={() => void handleDeleteStudent(deleteStudentDraft.student)}
                    type="button"
                  >
                    {deletingStudentId === deleteStudentDraft.student.id
                      ? "삭제 중..."
                      : "학생 계정 삭제"}
                  </button>
                </div>
              </div>
            ) : null}

            {!isLoading && students.length === 0 ? (
              <div className="mt-5 rounded-xl border border-dashed border-ink-200 bg-paper-base/60 px-6 py-12 text-center">
                <p className="text-lg font-semibold text-ink-900">아직 발급한 학생 계정이 없어요.</p>
                <p className="mt-2 text-sm text-ink-700">
                  위 카드에서 학생 계정을 발급하면 이곳에서 학급코드, 번호, 로그인 비밀번호를 확인할 수 있습니다.
                </p>
              </div>
            ) : null}

            {!isLoading && students.length > 0 ? (
              <div className="print-roster-table-wrap mt-5 overflow-x-auto rounded-xl border border-ink-100 bg-paper-base/35">
                <table className="w-full min-w-[760px] table-fixed border-collapse text-left text-sm">
                  <thead className="bg-paper-base text-xs font-semibold uppercase tracking-[0.12em] text-ink-500">
                    <tr>
                      <th className="w-[90px] px-4 py-3">번호</th>
                      <th className="w-[160px] px-4 py-3">학생 이름</th>
                      <th className="w-[150px] px-4 py-3">학급코드</th>
                      <th className="w-[170px] px-4 py-3">로그인 비밀번호</th>
                      <th className="w-[140px] px-4 py-3">발급일</th>
                      <th className="no-print w-[130px] px-4 py-3">정리</th>
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
                          {getIssuedLoginPassword(student, issuedLoginPasswords) ? (
                            <span className="rounded-md border border-feedback-pen/20 bg-feedback-soft px-2 py-1 font-mono font-bold text-feedback-pen">
                              {getIssuedLoginPassword(student, issuedLoginPasswords)}
                            </span>
                          ) : (
                            <span className="text-xs font-semibold text-ink-500">
                              재발급 후 표시
                            </span>
                          )}
                          <SecondaryButton
                            className="no-print ml-2 min-h-8 px-3 py-1 text-xs"
                            disabled={reissuingStudentId === student.id}
                            onClick={() => void handleReissueStudentPassword(student)}
                            type="button"
                          >
                            {reissuingStudentId === student.id ? "재발급 중" : "재발급"}
                          </SecondaryButton>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-ink-700">
                          {formatDate(student.createdAt)}
                        </td>
                        <td className="no-print whitespace-nowrap px-4 py-4">
                          <SecondaryButton
                            className="min-h-8 border-status-error/25 px-3 py-1 text-xs text-status-error hover:bg-status-error/5"
                            disabled={deletingStudentId === student.id}
                            onClick={() => {
                              setMessage("");
                              setError("");
                              setDeleteStudentDraft({ student, confirmation: "" });
                            }}
                            type="button"
                          >
                            {deletingStudentId === student.id ? "삭제 중" : "삭제 확인"}
                          </SecondaryButton>
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
                          공책톡톡
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
                            {getIssuedLoginPassword(student, issuedLoginPasswords) ||
                              "재발급 후 표시"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <p className="mt-4 rounded-lg bg-paper-sunk px-3 py-2 text-xs leading-5 text-ink-700">
                      공책톡톡 학생 로그인에서 학급코드, 번호, 로그인 비밀번호를 입력하세요. 비밀번호를 잊었다면 담임 선생님께 재발급을 요청하세요.
                    </p>
                  </article>
                ))}
              </div>
          </section>
        ) : null}

        {classroom && !isLoading ? (
          <section className="no-print rounded-xl border border-status-error/25 bg-paper-surface p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-status-error">
                  위험 작업
                </p>
                <h2 className="mt-1 text-xl font-bold text-ink-900">학급을 완전히 삭제할까요?</h2>
                <p className="kr-keep mt-2 max-w-2xl text-sm leading-6 text-ink-700">
                  이 학급의 학생 계정, 주제, 제출 글, OCR 글, 피드백이 함께 삭제됩니다.
                  삭제 후에는 복구할 수 없습니다.
                </p>
              </div>
              <Badge className="w-fit" tone="warning">
                복구 불가
              </Badge>
            </div>
            <label className="mt-4 block text-sm font-semibold text-ink-700">
              계속하려면 아래 칸에 ‘삭제’를 입력해 주세요.
              <input
                className="mt-2 h-10 rounded-md border-ink-100 bg-paper-surface text-sm text-ink-900 placeholder:text-ink-300 focus:border-status-error focus:ring-status-error/20"
                value={deleteClassroomConfirmation}
                onChange={(event) => setDeleteClassroomConfirmation(event.target.value)}
                placeholder="삭제"
              />
            </label>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <SecondaryButton
                className="h-10 min-h-10"
                onClick={() => setDeleteClassroomConfirmation("")}
                type="button"
              >
                취소
              </SecondaryButton>
              <button
                className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-md border border-status-error/30 bg-status-error px-4 text-sm font-semibold text-paper-surface hover:bg-status-error/90 disabled:cursor-not-allowed disabled:border-ink-100 disabled:bg-ink-200"
                disabled={deleteClassroomConfirmation !== "삭제" || isDeletingClassroom}
                onClick={() => void handleDeleteClassroom()}
                type="button"
              >
                {isDeletingClassroom ? "삭제 중..." : "학급 완전히 삭제"}
              </button>
            </div>
          </section>
        ) : null}
      </section>
    </div>
  );
}
