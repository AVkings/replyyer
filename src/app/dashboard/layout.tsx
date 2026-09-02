import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import Sidebar from "@/components/dashboard/Sidebar";

export const metadata = { title: "Dashboard — Repllyer" };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen bg-black text-white">
      <div className="hidden md:flex">
        <Sidebar email={user.email} />
      </div>

      {/* Mobile top bar */}
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-neutral-800 bg-black px-4 py-3 md:hidden">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-black text-xs font-bold">R</div>
            <span className="text-sm font-semibold">Repllyer</span>
          </div>
          <span className="text-xs text-neutral-500">{user.email}</span>
        </header>

        <main className="flex-1 bg-black p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
