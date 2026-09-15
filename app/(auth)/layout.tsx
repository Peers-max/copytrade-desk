export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-12">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-200px] h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-wise-green/25 blur-[120px]" />
      </div>
      {children}
    </div>
  );
}
