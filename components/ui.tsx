import React from "react";

export function cn(...args: Array<string | false | null | undefined>) {
  return args.filter(Boolean).join(" ");
}

export function Badge({
  children,
  tone = "default",
  className,
}: {
  children: React.ReactNode;
  tone?: "default" | "green" | "red" | "warn" | "dark";
  className?: string;
}) {
  const tones: Record<string, string> = {
    default: "bg-surface text-muted-foreground border-border",
    green: "bg-wise-mint text-wise-darkgreen border-wise-green/40",
    red: "bg-[#f6465d]/10 text-[#f6465d] border-[#f6465d]/30",
    warn: "bg-warning/15 text-[#8a6d00] border-warning/40",
    dark: "bg-foreground text-background border-transparent",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-pill border px-2.5 py-0.5 text-[11px] font-medium leading-5",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function Card({
  children,
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("card-surface p-5 sm:p-6", className)} {...rest}>
      {children}
    </div>
  );
}

export function SectionTitle({
  eyebrow,
  title,
  desc,
  align = "center",
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  desc?: React.ReactNode;
  align?: "center" | "left";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "max-w-2xl",
        align === "center" ? "mx-auto text-center" : "text-left",
        className
      )}
    >
      {eyebrow ? (
        <div className="mb-3 inline-flex items-center gap-2 rounded-pill border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-wise-green" />
          {eyebrow}
        </div>
      ) : null}
      <h2 className="text-balance text-[26px] font-bold leading-tight tracking-tight sm:text-[34px]">
        {title}
      </h2>
      {desc ? (
        <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground sm:text-[15px]">{desc}</p>
      ) : null}
    </div>
  );
}

/* ------------------------------- charts ------------------------------- */

function pathFrom(values: number[], w: number, h: number, pad = 2) {
  if (!values.length) return { line: "", area: "", pts: [] as Array<[number, number]> };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = (w - pad * 2) / (values.length - 1 || 1);
  const pts = values.map((v, i) => [
    pad + i * stepX,
    pad + (1 - (v - min) / span) * (h - pad * 2),
  ] as [number, number]);
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0].toFixed(2)},${h} L${pts[0][0].toFixed(2)},${h} Z`;
  return { line, area, pts };
}

export function Sparkline({
  data,
  width = 88,
  height = 28,
  color,
  className,
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}) {
  const up = data[data.length - 1] >= data[0];
  const stroke = color ?? (up ? "#0ecb81" : "#f6465d");
  const { line } = pathFrom(data, width, height);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} fill="none">
      <path d={line} stroke={stroke} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AreaChart({
  data,
  height = 220,
  color = "#9fe870",
  id = "ac",
  showAxis = true,
}: {
  data: number[];
  height?: number;
  color?: string;
  id?: string;
  showAxis?: boolean;
}) {
  const W = 720;
  const H = height;
  const { line, area } = pathFrom(data, W, H, 6);
  const min = Math.min(...data);
  const max = Math.max(...data);
  const gridY = [0.25, 0.5, 0.75];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" preserveAspectRatio="none" fill="none">
      <defs>
        <linearGradient id={`grad-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {showAxis &&
        gridY.map((g) => (
          <line
            key={g}
            x1="0"
            x2={W}
            y1={H * g}
            y2={H * g}
            stroke="currentColor"
            className="text-border"
            strokeWidth="1"
            strokeDasharray="4 6"
          />
        ))}
      <path d={area} fill={`url(#grad-${id})`} />
      <path d={line} stroke={color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
      <text x="4" y="14" className="fill-current text-[10px] text-muted-foreground">
        {max.toFixed(2)}
      </text>
      <text x="4" y={H - 4} className="fill-current text-[10px] text-muted-foreground">
        {min.toFixed(2)}
      </text>
    </svg>
  );
}

export function BarChart({
  data,
  height = 160,
}: {
  data: Array<{ day: string; pnl: number }>;
  height?: number;
}) {
  const W = 720;
  const H = height;
  const max = Math.max(...data.map((d) => Math.abs(d.pnl)), 1);
  const bw = (W - 20) / data.length;
  const zeroY = H / 2;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" preserveAspectRatio="none">
      <line x1="0" x2={W} y1={zeroY} y2={zeroY} className="stroke-border" strokeWidth="1" />
      {data.map((d, i) => {
        const h = (Math.abs(d.pnl) / max) * (H / 2 - 12);
        const y = d.pnl >= 0 ? zeroY - h : zeroY;
        return (
          <rect
            key={d.day + i}
            x={10 + i * bw + bw * 0.18}
            y={y}
            width={bw * 0.64}
            height={Math.max(2, h)}
            rx="3"
            fill={d.pnl >= 0 ? "#0ecb81" : "#f6465d"}
            opacity="0.9"
          />
        );
      })}
    </svg>
  );
}

export function Donut({
  data,
  size = 168,
}: {
  data: Array<{ name: string; value: number; pct: number }>;
  size?: number;
}) {
  const colors = ["#9fe870", "#4cc9f0", "#ffd11a", "#f6465d", "#b388ff", "#0ecb81", "#ff9f45"];
  const total = data.reduce((a, b) => a + b.value, 0) || 1;
  const r = size / 2 - 14;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      {data.map((d, i) => {
        const len = (d.value / total) * c;
        const el = (
          <circle
            key={d.name}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={colors[i % colors.length]}
            strokeWidth={16}
            strokeDasharray={`${len} ${c - len}`}
            strokeDashoffset={-offset}
          />
        );
        offset += len;
        return el;
      })}
    </svg>
  );
}

export function RiskPill({ risk }: { risk: "low" | "medium" | "high" }) {
  const map = {
    low: { text: "低风险", tone: "green" as const },
    medium: { text: "中风险", tone: "warn" as const },
    high: { text: "高风险", tone: "red" as const },
  };
  const m = map[risk];
  return <Badge tone={m.tone}>{m.text}</Badge>;
}

export function Avatar({ name, hue }: { name: string; hue: number }) {
  const initials = name.slice(0, 2).toUpperCase();
  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-wise-darkgreen"
      style={{ background: `hsl(${hue} 72% 78%)` }}
    >
      {initials}
    </div>
  );
}
