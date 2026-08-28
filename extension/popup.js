/**
 * BlockSmith Capture — popup.
 *
 * Capture visible tab (up to 4 shots of the same design: different frames,
 * scroll positions, states) → Generate sends them to /api/ingest/capture,
 * which runs vision extraction and returns the wiki URL of the new design.md.
 *
 * Session captures live in chrome.storage.session (cleared when the browser
 * closes); the server URL persists in chrome.storage.sync.
 */
const DEFAULT_SERVER = "https://blocksmithv1.vercel.app";
const MAX_CAPTURES = 4;

const el = (id) => document.getElementById(id);

async function getState() {
  const { captures = [], meta = {} } =
    await chrome.storage.session.get(["captures", "meta"]);
  return { captures, meta };
}

async function getServer() {
  const { server } = await chrome.storage.sync.get("server");
  return (server || DEFAULT_SERVER).replace(/\/+$/, "");
}

function setStatus(msg, isError = false, asHtml = false) {
  const s = el("status");
  s.className = isError ? "error" : "";
  if (asHtml) s.innerHTML = msg;
  else s.textContent = msg;
}

async function render() {
  const { captures } = await getState();
  el("thumbs").innerHTML = captures
    .map((c) => `<img src="${c}" alt="capture" />`)
    .join("");
  el("count").textContent = `${captures.length} capture${captures.length === 1 ? "" : "s"}`;
  el("generate").disabled = captures.length === 0;
  el("capture").disabled = captures.length >= MAX_CAPTURES;
  el("capture").textContent =
    captures.length >= MAX_CAPTURES
      ? `Max ${MAX_CAPTURES} captures`
      : "📸 Capture this tab";
}

el("capture").addEventListener("click", async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const dataUrl = await chrome.tabs.captureVisibleTab(null, {
      format: "jpeg",
      quality: 82,
    });
    const { captures, meta } = await getState();
    if (captures.length >= MAX_CAPTURES) return;
    captures.push(dataUrl);
    await chrome.storage.session.set({
      captures,
      meta: {
        sourceUrl: meta.sourceUrl || tab?.url || "",
        title: meta.title || tab?.title || "",
      },
    });
    if (!el("targetDoc").value) {
      const inferred = figmaDocRef(tab?.url || "");
      if (inferred) el("targetDoc").value = inferred;
    }
    setStatus("Captured. Add more views or generate.");
    await render();
  } catch (err) {
    setStatus(`Capture failed: ${err.message}`, true);
  }
});

el("clear").addEventListener("click", async () => {
  await chrome.storage.session.remove(["captures", "meta"]);
  setStatus("");
  await render();
});

el("generate").addEventListener("click", async () => {
  const { captures, meta } = await getState();
  if (!captures.length) return;
  const server = await getServer();
  el("generate").disabled = true;
  el("capture").disabled = true;
  setStatus("Extracting design system… (10–30s)");
  try {
    const res = await fetch(`${server}/api/ingest/capture`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        images: captures,
        sourceUrl: meta.sourceUrl,
        title: cleanTitle(meta.title),
        targetDoc: el("targetDoc").value.trim() || undefined,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `Server error (${res.status})`);
    await chrome.storage.session.remove(["captures", "meta"]);
    const s = body.stats || {};
    const openUrl = body.wikiUrl || body.reviewUrl;
    setStatus(
      `${body.enrichedExisting ? "Figma design.md enriched" : "Draft created"} — ${s.colors ?? "?"} colors, ${s.components ?? "?"} components (visual estimates). ` +
        `Review &amp; edit it in BlockSmith, then confirm it as your design.md. ` +
        `<a href="${openUrl}" target="_blank">Open draft →</a>`,
      false,
      true,
    );
    chrome.tabs.create({ url: openUrl, active: true });
    await render();
  } catch (err) {
    setStatus(err.message, true);
    await render();
  }
});

/** "My Design – Canva" → "My Design" */
function cleanTitle(title) {
  return (title || "")
    .replace(/\s*[–—|-]\s*(Canva|Figma|Adobe.*|XD)\s*$/i, "")
    .trim()
    .slice(0, 80);
}

/** Connector imports use workspaceId figma-<fileKey>, yielding this stable ref. */
function figmaDocRef(url) {
  const match = String(url).match(/figma\.com\/(?:design|file)\/([a-zA-Z0-9]+)/i);
  if (!match) return "";
  const slug = `figma-${match[1]}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
  return `upload:scan-${slug}.md`;
}

(async () => {
  el("server").value = await getServer();
  el("server").addEventListener("change", async (e) => {
    await chrome.storage.sync.set({ server: e.target.value.trim() });
  });
  await render();
})();
