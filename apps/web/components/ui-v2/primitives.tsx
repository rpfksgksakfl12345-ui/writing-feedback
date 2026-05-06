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
      className={cx("rounded-xl border border-[#E8DEC7] bg-[#FFFAF0] p-6 shadow-sm", className)}
      {...props}
    />
  );
}

type PrimaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "student" | "teacher";
};

export function PrimaryButton({ className, tone = "student", ...props }: PrimaryButtonProps) {
  const toneClass =
    tone === "teacher"
      ? "bg-teacher-accent shadow-[0_1px_0_rgba(40,60,90,.15),0_2px_6px_rgba(60,80,120,.18)] hover:bg-teacher-accent/90"
      : "bg-student-accent shadow-[0_1px_0_rgba(120,60,30,.15),0_2px_6px_rgba(180,90,50,.18)] hover:bg-student-accent/90";

  return (
    <button
      className={cx(
        "inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-md px-[18px] py-[13px] text-[15px] font-semibold text-[#FFFAF0] disabled:cursor-not-allowed disabled:bg-[#D6CCB3]",
        toneClass,
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
        "inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-md border border-[#E8DEC7] bg-[#FFFAF0] px-[18px] py-[13px] text-[15px] font-semibold text-[#2E2A24] hover:bg-[#F4ECDC] disabled:cursor-not-allowed disabled:text-[#A89C85]",
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
        "h-11 rounded-md border-[#E8DEC7] bg-[#FFFAF0] text-sm text-[#2E2A24] placeholder:text-[#A89C85] focus:border-student-accent focus:ring-student-accent/20",
        error && "border-[#B0533A] focus:border-[#B0533A] focus:ring-[#B0533A]/20",
        className,
      )}
      {...props}
    />
  );

  return (
    <div className="space-y-1.5">
      {label ? (
        <label className="block text-sm font-medium text-[#5A5247]">
          <span className="mb-1 block">{label}</span>
          {input}
        </label>
      ) : (
        input
      )}
      {helperText && !error ? <p className="text-xs text-[#8B8170]">{helperText}</p> : null}
      {error ? <p className="text-xs text-[#B0533A]">{error}</p> : null}
    </div>
  );
}

type BadgeProps = ComponentPropsWithoutRef<"span"> & {
  tone?: "neutral" | "student" | "teacher" | "feedback" | "success";
};

export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  const toneClass = {
    neutral: "border-[#E8DEC7] bg-paper-base text-[#5A5247]",
    student: "border-student-accent/30 bg-student-accent/15 text-[#8A4B2B]",
    teacher: "border-teacher-accent/30 bg-teacher-accent/15 text-teacher-accent",
    feedback: "border-feedback-pen/25 bg-feedback-pen/10 text-feedback-pen",
    success: "border-[#6B8C5A]/25 bg-[#E5EFE0] text-[#5C7D4D]",
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
