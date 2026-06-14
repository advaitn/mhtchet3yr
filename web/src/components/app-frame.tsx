import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export function AppFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full w-full min-w-0 flex-col overflow-x-clip">
      <SiteHeader />
      {children}
      <SiteFooter />
    </div>
  );
}
