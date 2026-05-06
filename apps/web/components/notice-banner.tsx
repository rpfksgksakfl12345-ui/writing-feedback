type NoticeBannerProps = {
  tone: "success" | "error" | "info";
  title: string;
  description?: string;
};

const toneClasses: Record<NoticeBannerProps["tone"], string> = {
  success: "border-status-feedbackDone/25 bg-status-feedbackDone/15 text-status-feedbackDone",
  error: "border-status-error/25 bg-status-error/10 text-status-error",
  info: "border-feedback-pen/20 bg-feedback-soft text-feedback-pen",
};

export function NoticeBanner({ tone, title, description }: NoticeBannerProps) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${toneClasses[tone]}`}>
      <p className="text-sm font-semibold">{title}</p>
      {description ? <p className="mt-1 whitespace-pre-line text-sm opacity-90">{description}</p> : null}
    </div>
  );
}
