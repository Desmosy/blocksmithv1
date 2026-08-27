/**
 * Shown while a design system opens.
 *
 * The wiki is force-dynamic, so the server re-renders on every request and
 * TTFB sits close to a second — which is long enough that this fallback is
 * seen on essentially every navigation, not just slow ones. It used to be a
 * centred spinner on a hardcoded #f8fafc, a colour that matches neither theme,
 * so each navigation flashed a grey screen belonging to no part of the app.
 *
 * It now draws the chrome that is about to appear — rail, sidebar, header —
 * in the wiki's own tokens and at the same dimensions. The layout does not
 * move when the content arrives, so the wait reads as the page filling in
 * rather than as a different screen.
 */
export default function WikiLoading() {
  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ backgroundColor: "var(--wiki-bg, #ffffff)" }}
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Opening design system…</span>

      {/* Rail — same 76px as WikiRail. */}
      <div
        className="flex w-[76px] shrink-0 flex-col items-center gap-1 border-r py-3"
        style={{
          borderColor: "var(--wiki-border, #e5e7eb)",
          backgroundColor: "var(--wiki-sidebar, #fafafa)",
        }}
      >
        <div className="mb-4 size-9 rounded-lg bg-[var(--wiki-active,#f0f0f0)]" />
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-12 w-[60px] rounded-lg bg-[var(--wiki-active,#f0f0f0)] opacity-60"
          />
        ))}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header — same 56px as WikiWorkspaceBar. */}
        <div
          className="flex h-14 shrink-0 items-center gap-4 border-b px-5"
          style={{
            borderColor: "var(--wiki-border, #e5e7eb)",
            backgroundColor: "var(--wiki-sidebar, #fafafa)",
          }}
        >
          <div className="h-4 w-32 rounded bg-[var(--wiki-active,#f0f0f0)]" />
          <div className="h-8 w-full max-w-xs rounded-lg bg-[var(--wiki-active,#f0f0f0)] opacity-70" />
        </div>

        <div className="flex min-h-0 flex-1">
          {/* Sidebar — reads the same width variable the real one does. */}
          <div
            className="shrink-0 space-y-2 border-r p-4"
            style={{
              width: "var(--wiki-sidebar-width, 15rem)",
              borderColor: "var(--wiki-border, #e5e7eb)",
              backgroundColor: "var(--wiki-sidebar, #fafafa)",
            }}
          >
            <div className="h-8 rounded-md bg-[var(--wiki-active,#f0f0f0)]" />
            {[70, 55, 62, 48, 58].map((w, i) => (
              <div
                key={i}
                className="h-5 rounded bg-[var(--wiki-active,#f0f0f0)] opacity-50"
                style={{ width: `${w}%` }}
              />
            ))}
          </div>

          <div className="min-w-0 flex-1 p-10">
            <div className="mx-auto max-w-3xl space-y-4">
              <div className="h-40 rounded-lg bg-[var(--wiki-active,#f0f0f0)] opacity-60" />
              <div className="h-9 w-56 rounded bg-[var(--wiki-active,#f0f0f0)]" />
              {[100, 96, 92].map((w, i) => (
                <div
                  key={i}
                  className="h-4 rounded bg-[var(--wiki-active,#f0f0f0)] opacity-50"
                  style={{ width: `${w}%` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
