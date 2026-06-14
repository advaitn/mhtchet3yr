export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">LawCET Guide</p>
            <p>Comprehensive law admission data and intelligence</p>
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Data covers 2024–2025 admission cycles</p>
            <p>Maharashtra (MS) and OMS pools analyzed separately</p>
          </div>
        </div>
        <div className="border-t border-border pt-4 text-xs text-muted-foreground space-y-1">
          <p>
            This website is an independent project and is{" "}
            <strong className="text-foreground">not affiliated with, endorsed by, or associated</strong>{" "}
            with the Maharashtra State CET Cell, any law college, or any government body.
            All data is sourced from publicly available admission records and is provided for informational
            purposes only. Accuracy is not guaranteed.
          </p>
          <p>
            For takedown requests, corrections, or feedback, contact{" "}
            <a
              href="mailto:advait.nandeshwar@gmail.com"
              className="underline hover:text-foreground transition-colors"
            >
              advait.nandeshwar@gmail.com
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
