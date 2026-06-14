import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { DataDisclaimer } from "@/components/data-disclaimer";

export function AppFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full w-full min-w-0 flex-col overflow-x-clip">
      <SiteHeader />
      <DataDisclaimer />
      {children}
      <SiteFooter />
    </div>
  );
}
