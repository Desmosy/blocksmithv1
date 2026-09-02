/**
 * Instant feedback while a wiki page renders on the server.
 *
 * Without this, clicking a nav item did nothing visible until the whole
 * server render returned — readers assumed the click missed and clicked
 * again. The skeleton is deliberately neutral: it renders before the
 * document (and therefore its theme) is known.
 */
export default function WikiLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading design system"
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "#fafafa",
      }}
    >
      <style>{`
        @keyframes wiki-shimmer {
          0% { opacity: 0.45; }
          50% { opacity: 1; }
          100% { opacity: 0.45; }
        }
        .wiki-skel { background: #e8e8e8; border-radius: 6px; animation: wiki-shimmer 1.2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .wiki-skel { animation: none; } }
      `}</style>
      <aside
        style={{
          width: 248,
          borderRight: "1px solid #ececec",
          padding: "24px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div className="wiki-skel" style={{ height: 28, width: "70%" }} />
        <div style={{ height: 10 }} />
        {[88, 64, 76, 58, 70, 82, 60].map((w, i) => (
          <div key={i} className="wiki-skel" style={{ height: 12, width: `${w}%` }} />
        ))}
      </aside>
      <main style={{ flex: 1, padding: "48px 56px", maxWidth: 920 }}>
        <div className="wiki-skel" style={{ height: 14, width: 120, marginBottom: 20 }} />
        <div className="wiki-skel" style={{ height: 40, width: "55%", marginBottom: 28 }} />
        <div className="wiki-skel" style={{ height: 12, width: "88%", marginBottom: 12 }} />
        <div className="wiki-skel" style={{ height: 12, width: "82%", marginBottom: 12 }} />
        <div className="wiki-skel" style={{ height: 12, width: "60%", marginBottom: 36 }} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="wiki-skel" style={{ height: 140 }} />
          ))}
        </div>
      </main>
    </div>
  );
}
