import type { Metadata } from "next";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { BizProvider } from "@/components/dashboard/BizContext";
import { OnboardingPopup } from "@/components/OnboardingPopup";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <BizProvider>
      <div className="mx-auto flex max-w-6xl">
        <Sidebar />
        <div className="min-w-0 flex-1 px-6 py-6">{children}</div>
      </div>
      <OnboardingPopup />
    </BizProvider>
  );
}
