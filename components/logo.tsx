export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-[9px] bg-wise-green font-black text-wise-darkgreen"
      style={{ width: size, height: size, fontSize: size * 0.56 }}
    >
      C
    </span>
  );
}
