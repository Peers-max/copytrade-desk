import { redirect } from "next/navigation";
import { ConsoleSidebar } from "@/components/console/sidebar";
import { getSessionUser } from "@/lib/auth";
import { count } from "@/lib/db";
import { PLANS } from "@/lib/seed";

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/dashboard");

  const unread = await count("notifications", (n: any) => n.userId === user.id && !n.read);
  const planName = PLANS.find((p) => p.id === user.planId)?.name ?? "免费版";

  return (
    <div className="flex min-h-screen bg-background">
      <ConsoleSidebar
        user={{ nickname: user.nickname, email: user.email, planName, avatarHue: user.avatarHue }}
        unread={unread}
      />
      <div className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-[1240px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </div>
    </div>
  );
}
