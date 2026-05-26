type SubmissionStatus = "PENDING" | "REVIEWED";

const statusLabel: Record<SubmissionStatus, string> = {
  PENDING: "피드백 필요",
  REVIEWED: "피드백 완료",
};

const statusClasses: Record<SubmissionStatus, string> = {
  PENDING: "bg-status-writing/15 text-status-writing",
  REVIEWED: "bg-status-feedbackDone/15 text-status-feedbackDone",
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
