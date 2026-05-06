type NoticeBannerProps = {
  tone: "success" | "error" | "info";
  title: string;
  description?: string;
};

const toneClasses: Record<NoticeBannerProps["tone"], string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  error: "border-red-200 bg-red-50 text-red-900",
  info: "border-sky-200 bg-sky-50 text-sky-900",
};

export function NoticeBanner({ tone, title, description }: NoticeBannerProps) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${toneClasses[tone]}`}>
      <p className="text-sm font-semibold">{title}</p>
      {description ? <p className="mt-1 whitespace-pre-line text-sm opacity-90">{description}</p> : null}
    </div>
  );
}
