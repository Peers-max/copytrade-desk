import Link from "next/link";

export function AuthCard({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="w-full max-w-[420px]">
      <Link href="/" className="mb-8 flex items-center justify-center gap-2">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-[9px] bg-wise-green text-[15px] font-black text-wise-darkgreen">
          C
        </span>
        <span className="text-[18px] font-bold">币策</span>
      </Link>
      <div className="rounded-card-lg border border-border bg-card p-7 shadow-card">
        <h1 className="text-[22px] font-bold tracking-tight">{title}</h1>
        {desc ? <p className="mt-1.5 text-[13px] text-muted-foreground">{desc}</p> : null}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
