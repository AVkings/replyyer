import { Sidebar } from "@/components/dashboard/Sidebar";
import { BizProvider } from "@/components/dashboard/BizContext";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <BizProvider>
      <div className="mx-auto flex max-w-6xl">
        <Sidebar />
        <div className="min-w-0 flex-1 px-6 py-6">{children}</div>
      </div>
    </BizProvider>
  );
}
