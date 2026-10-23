import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { formatBRL, statusLabel, statusTone } from "@/lib/quadra/format";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium outline-none transition-[transform,background-color,opacity] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-pine/40 focus-visible:ring-offset-2 focus-visible:ring-offset-paper active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-pine text-mist hover:bg-pine/90",
        secondary: "border border-line bg-card text-ink hover:bg-moss",
        ghost: "text-ink hover:bg-moss",
        danger: "border border-line bg-card text-danger hover:bg-paper",
      },
      size: {
        md: "h-11 px-4",
        sm: "h-10 px-3",
        lg: "h-12 px-5 text-base",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} type={asChild ? undefined : type} {...props} />;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {children}
      {hint ? <span className="mt-1.5 block text-sm text-faint">{hint}</span> : null}
    </label>
  );
}

const controlClass =
  "h-11 w-full rounded-md border border-line bg-card px-3 text-base text-ink outline-none placeholder:text-faint focus-visible:ring-2 focus-visible:ring-pine/30";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(controlClass, props.className)} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn("min-h-24 w-full rounded-md border border-line bg-card px-3 py-2 text-base text-ink outline-none placeholder:text-faint focus-visible:ring-2 focus-visible:ring-pine/30", props.className)}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(controlClass, props.className)} />;
}

export function Badge({ status, children }: { status?: string; children?: ReactNode }) {
  const tone = statusTone(status ?? "neutral");
  const tones = {
    neutral: "bg-paper text-muted",
    pine: "bg-moss text-pine",
    warn: "bg-paper text-warn",
    danger: "bg-paper text-danger",
  };
  return (
    <span className={cn("inline-flex items-center rounded-sm px-2 py-1 text-xs font-medium", tones[tone])}>
      {children ?? statusLabel(status ?? "")}
    </span>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("rounded-xl border border-line bg-card p-4", className)}>{children}</section>;
}

export function Money({ cents, className }: { cents: number; className?: string }) {
  return <span className={cn("tabular-nums", className)}>{formatBRL(cents)}</span>;
}

export function PageHeader({ kicker, title, lede }: { kicker?: string; title: string; lede?: string }) {
  return (
    <header className="mb-6">
      {kicker ? <p className="text-sm font-medium text-pine">{kicker}</p> : null}
      <h1 className="mt-1 text-3xl text-ink md:text-4xl">{title}</h1>
      {lede ? <p className="mt-2 max-w-xl text-muted">{lede}</p> : null}
    </header>
  );
}

export function Empty({ title, lede, action }: { title: string; lede?: string; action?: ReactNode }) {
  return (
    <Card className="py-8 text-center">
      <h2 className="text-xl">{title}</h2>
      {lede ? <p className="mx-auto mt-2 max-w-md text-sm text-muted">{lede}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </Card>
  );
}

export function ErrorNote({ children }: { children: string }) {
  return <p className="rounded-md border border-line bg-card px-3 py-2 text-sm text-danger">{children}</p>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-line", className)} />;
}

export function PageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-28 w-full" />
    </div>
  );
}
