import React from "react";
import { cn } from "@/components/ui";

export function PageHeader({
  title,
  desc,
  actions,
}: {
  title: string;
  desc?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight sm:text-[26px]">{title}</h1>
        {desc ? <p className="mt-1 text-[13.5px] text-muted-foreground">{desc}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  tone,
  icon: Icon,
  chart,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "up" | "down" | "neutral";
  icon?: any;
  chart?: React.ReactNode;
}) {
  return (
    <div className="card-surface p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[12.5px] text-muted-foreground">{label}</span>
        {Icon ? (
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface text-muted-foreground">
            <Icon size={14} />
          </span>
        ) : null}
      </div>
      <div
        className={cn(
          "num mt-2 text-[22px] font-bold leading-none sm:text-[26px]",
          tone === "up" ? "text-[#0ecb81]" : tone === "down" ? "text-[#f6465d]" : ""
        )}
      >
        {value}
      </div>
      {sub ? <div className="mt-1.5 text-[12px] text-muted-foreground">{sub}</div> : null}
      {chart ? <div className="mt-3">{chart}</div> : null}
    </div>
  );
}

export function Panel({
  title,
  desc,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: React.ReactNode;
  desc?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("card-surface", className)}>
      {title ? (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-[15px] font-semibold">{title}</h2>
            {desc ? <p className="mt-0.5 text-[12px] text-muted-foreground">{desc}</p> : null}
          </div>
          {actions}
        </div>
      ) : null}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

export function Empty({ text, action }: { text: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-12 text-center">
      <p className="text-[13.5px] text-muted-foreground">{text}</p>
      {action}
    </div>
  );
}

export function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={cn("whitespace-nowrap px-4 py-2.5 text-left text-[12px] font-medium text-muted-foreground", className)}>
      {children}
    </th>
  );
}

export function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cn("whitespace-nowrap px-4 py-3 text-[13px]", className)}>{children}</td>;
}
