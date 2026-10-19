import type { ComponentProps, ReactNode } from "react";

/** 380px card used by both the site login and the admin login */
export function LoginCard({
  eyebrow,
  title,
  action,
  error,
  children,
}: {
  eyebrow: string;
  title: string;
  action: (form: FormData) => void;
  error?: string;
  children: ReactNode;
}) {
  return (
    <form action={action} noValidate className="flex w-full max-w-[380px] flex-col gap-3.5 rounded-panel border border-line bg-panel p-6">
      <div>
        <div className="eyebrow mb-1">{eyebrow}</div>
        <h1 className="text-[20px] font-bold text-fg">{title}</h1>
      </div>
      {children}
      {error && (
        <p role="alert" className="rounded-chip border border-err-line bg-err-bg px-2.5 py-2 text-[12.5px] text-err-title">
          {error}
        </p>
      )}
    </form>
  );
}

export function LoginField({ label, ...props }: ComponentProps<"input"> & { label: string }) {
  return (
    <label className="flex flex-col gap-1.5 text-[12.5px] text-fg-2">
      {label}
      <input
        className="h-[38px] rounded-ctl border border-line bg-app px-2.5 text-[13px] text-fg placeholder:text-faint"
        {...props}
      />
    </label>
  );
}
