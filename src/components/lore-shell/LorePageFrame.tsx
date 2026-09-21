export function LorePageFrame({
  topBar,
  rightRail,
  children,
}: {
  topBar: React.ReactNode;
  rightRail?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      {topBar}
      <div className="flex min-h-0 flex-1">
        <main
          id="lore-main-content"
          tabIndex={-1}
          className="min-w-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
        >
          {children}
        </main>
        {rightRail}
      </div>
    </div>
  );
}
