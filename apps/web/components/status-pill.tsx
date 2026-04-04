type SubmissionStatus = "PENDING" | "REVIEWED";

const statusLabel: Record<SubmissionStatus, string> = {
  PENDING: "피드백 대기",
  REVIEWED: "피드백 완료",
};

const statusClasses: Record<SubmissionStatus, string> = {
  PENDING: "bg-amber-100 text-amber-900",
  REVIEWED: "bg-emerald-100 text-emerald-900",
};

export function StatusPill({ status }: { status: SubmissionStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses[status]}`}
    >
      {statusLabel[status]}
    </span>
  );
}
