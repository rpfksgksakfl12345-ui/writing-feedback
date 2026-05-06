import type {
  ButtonHTMLAttributes,
  ComponentPropsWithoutRef,
  InputHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function PaperCard({ className, ...props }: ComponentPropsWithoutRef<"section">) {
  return (
    <section
      className={cx("rounded-xl border border-ink-100 bg-paper-surface p-6 shadow-sm", className)}
      {...props}
    />
  );
}

type PrimaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: "sm" | "md" | "lg";
  tone?: "student" | "teacher";
};

export function PrimaryButton({
  className,
  size = "md",
  tone = "student",
  ...props
}: PrimaryButtonProps) {
  const toneClass =
    tone === "teacher"
      ? "bg-teacher-accent shadow-[0_1px_0_rgba(40,60,90,.15),0_2px_6px_rgba(60,80,120,.18)] hover:bg-teacher-accent/90"
      : "bg-student-accent shadow-[0_1px_0_rgba(120,60,30,.15),0_2px_6px_rgba(180,90,50,.18)] hover:bg-student-accent/90";
  const sizeClass = {
    sm: "h-9 px-3 text-sm",
    md: "h-11 px-4 text-sm",
    lg: "h-12 px-5 text-base",
  }[size];

  return (
    <button
      className={cx(
        "inline-flex items-center justify-center whitespace-nowrap rounded-md font-semibold text-paper-surface disabled:cursor-not-allowed disabled:bg-ink-200",
        toneClass,
        sizeClass,
        className,
      )}
      {...props}
    />
  );
}

export function SecondaryButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cx(
        "inline-flex h-11 items-center justify-center whitespace-nowrap rounded-md border border-ink-100 bg-paper-surface px-4 text-sm font-semibold text-ink-900 hover:bg-paper-base disabled:cursor-not-allowed disabled:text-ink-300",
        className,
      )}
      {...props}
    />
  );
}

type TextInputProps = InputHTMLAttributes<HTMLInputElement> & {
  error?: string;
  helperText?: string;
  label?: string;
};

export function TextInput({ className, error, helperText, label, ...props }: TextInputProps) {
  const input = (
    <input
      className={cx(
        "h-11 rounded-md border-ink-100 bg-paper-surface text-sm text-ink-900 placeholder:text-ink-300 focus:border-student-accent focus:ring-student-accent/20",
        error && "border-status-error focus:border-status-error focus:ring-status-error/20",
        className,
      )}
      {...props}
    />
  );

  return (
    <div className="space-y-1.5">
      {label ? (
        <label className="block text-sm font-medium text-ink-700">
          <span className="mb-1 block">{label}</span>
          {input}
        </label>
      ) : (
        input
      )}
      {helperText && !error ? <p className="text-xs text-ink-500">{helperText}</p> : null}
      {error ? <p className="text-xs text-status-error">{error}</p> : null}
    </div>
  );
}

type BadgeProps = ComponentPropsWithoutRef<"span"> & {
  tone?: "neutral" | "student" | "teacher" | "feedback" | "success" | "warning";
};

export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  const toneClass = {
    neutral: "border-ink-100 bg-paper-base text-ink-700",
    student: "border-student-accent/30 bg-student-soft text-student-deep",
    teacher: "border-teacher-accent/30 bg-teacher-accent/15 text-teacher-accent",
    feedback: "border-feedback-pen/25 bg-feedback-pen/10 text-feedback-pen",
    success: "border-status-feedbackDone/25 bg-status-feedbackDone/15 text-status-feedbackDone",
    warning: "border-status-writing/30 bg-status-writing/15 text-status-writing",
  }[tone];

  return (
    <span
      className={cx(
        "inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none",
        toneClass,
        className,
      )}
      {...props}
    />
  );
}

export function NotebookPaper({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cx("ui-v2-notebook-paper rounded-xl border border-[#E8DEC7] px-5 py-6", className)}
      {...props}
    />
  );
}

export function NotebookText({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return <div className={cx("ui-v2-notebook-content min-h-[264px]", className)} {...props} />;
}

export function NotebookTextArea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <NotebookPaper>
      <textarea className={cx("ui-v2-notebook-textarea min-h-[264px]", className)} {...props} />
    </NotebookPaper>
  );
}
