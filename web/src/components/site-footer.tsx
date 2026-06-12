export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">LawCET Guide</p>
          <p>Comprehensive law admission data and intelligence</p>
        </div>
        <div className="text-xs text-muted-foreground space-y-1">
          <p>Data covers 2023–2025 admission cycles</p>
          <p>Maharashtra (MS) and OMS pools analyzed separately</p>
        </div>
      </div>
    </footer>
  );
}
