/*
 * BlockSmith on any site.
 *
 * Run on a page you did not build — by bookmarklet, or by the extension's
 * content script — this registers BlockSmith's tools with that page's
 * document.modelContext. An agent browsing the site can then read its design
 * system, or judge what the page paints against a system it governs.
 *
 * The page only collects. Judgement, capture and rules all come from the
 * BlockSmith origin this script was loaded from, over CORS.
 *
 * Plain script on purpose: it runs inside pages with every kind of build
 * setup, and none of them. The tool names and descriptions here are mirrored
 * in src/lib/webmcp/anywhere-tools.ts, which the manifest and the verifier
 * read; keep the two in step.
 */
(function () {
  "use strict";
  if (window.__blocksmithWebMcp) return;
  window.__blocksmithWebMcp = true;

  var DEFAULT_ORIGIN = "https://blocksmithv1.vercel.app";
  var origin = (function () {
    if (window.__BLOCKSMITH_ORIGIN) return String(window.__BLOCKSMITH_ORIGIN);
    var s = document.currentScript;
    if (s && s.src) {
      try { return new URL(s.src).origin; } catch (e) { /* fall through */ }
    }
    return DEFAULT_ORIGIN;
  })();

  /* ---------------------------------------------------------------- badge */
  var host = document.createElement("div");
  host.setAttribute("data-blocksmith", "");
  var root = host.attachShadow ? host.attachShadow({ mode: "closed" }) : host;
  var badge = document.createElement("div");
  badge.setAttribute("role", "status");
  var style = document.createElement("style");
  style.textContent =
    ":host{all:initial}" +
    ".b{position:fixed;right:16px;bottom:16px;z-index:2147483646;display:flex;align-items:center;gap:8px;" +
    "font:12px/1.2 ui-sans-serif,system-ui,sans-serif;color:#111;background:#fff;border:1px solid #d9d9de;" +
    "border-radius:999px;padding:8px 10px 8px 12px;box-shadow:0 4px 16px rgba(0,0,0,.12)}" +
    ".d{width:6px;height:6px;border-radius:50%;background:#111}.d.off{background:#fff;border:1px solid #111}" +
    ".x{all:unset;cursor:pointer;color:#666;padding:0 2px}.x:hover{color:#111}" +
    "a{color:inherit}";
  root.appendChild(style);
  root.appendChild(badge);
  function showBadge(text, ok) {
    badge.className = "b";
    badge.innerHTML = "";
    var dot = document.createElement("span");
    dot.className = "d" + (ok ? "" : " off");
    var label = document.createElement("span");
    label.textContent = text;
    var close = document.createElement("button");
    close.className = "x";
    close.textContent = "×";
    close.setAttribute("aria-label", "Hide");
    close.onclick = function () { host.remove(); };
    badge.appendChild(dot);
    badge.appendChild(label);
    badge.appendChild(close);
    if (!host.isConnected) (document.body || document.documentElement).appendChild(host);
  }

  var mc = document.modelContext;
  if (!mc || typeof mc.registerTool !== "function") {
    showBadge("BlockSmith: this browser has no WebMCP (chrome://flags/#enable-webmcp-testing)", false);
    return;
  }

  /* -------------------------------------------------------------- collect */
  function toHex(c) {
    var m = /^rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?/.exec(c || "");
    if (!m) return null;
    if (m[4] !== undefined && parseFloat(m[4]) < 0.05) return null;
    return "#" + [m[1], m[2], m[3]].map(function (n) { return ("0" + Number(n).toString(16)).slice(-2); }).join("");
  }
  function collect() {
    var colors = {}, fonts = {}, radii = {};
    var all = document.body ? document.body.querySelectorAll("*") : [];
    var n = 0;
    var vw = window.innerWidth, vh = window.innerHeight;
    for (var i = 0; i < all.length && n < 2500; i++) {
      var el = all[i];
      if (el.closest && el.closest("[data-blocksmith]")) continue;
      var r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2 || r.bottom < -vh || r.top > vh * 3) continue;
      var cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none") continue;
      n++;
      var area = Math.min(r.width * r.height, vw * vh) / 1000;
      var bg = toHex(cs.backgroundColor);
      if (bg) { colors[bg] = colors[bg] || { value: bg, count: 0, role: "fill" }; colors[bg].count += Math.max(1, Math.round(area)); }
      var hasText = el.childNodes.length && Array.prototype.some.call(el.childNodes, function (c) { return c.nodeType === 3 && c.textContent.trim(); });
      if (hasText) {
        var fg = toHex(cs.color);
        if (fg) { colors[fg] = colors[fg] || { value: fg, count: 0, role: "text" }; colors[fg].count += 1; }
        var ff = (cs.fontFamily || "").split(",")[0].replace(/["']/g, "").trim();
        if (ff) fonts[ff] = (fonts[ff] || 0) + 1;
      }
      if (cs.borderTopStyle !== "none" && parseFloat(cs.borderTopWidth) > 0) {
        var bc = toHex(cs.borderTopColor);
        if (bc) { colors[bc] = colors[bc] || { value: bc, count: 0, role: "border" }; colors[bc].count += 1; }
      }
      var rad = cs.borderTopLeftRadius;
      if (rad && rad !== "0px" && r.width < vw * 0.9) radii[rad] = (radii[rad] || 0) + 1;
    }
    var colorList = Object.keys(colors).map(function (k) { return colors[k]; }).sort(function (a, b) { return b.count - a.count; }).slice(0, 40);
    var fontList = Object.keys(fonts).sort(function (a, b) { return fonts[b] - fonts[a]; }).slice(0, 6);
    var radiiList = Object.keys(radii).sort(function (a, b) { return radii[b] - radii[a]; }).slice(0, 8);
    return { url: location.href, title: document.title, elements: n, colors: colorList, fonts: fontList, radii: radiiList };
  }

  /* ---------------------------------------------------------------- calls */
  function text(t) { return { content: [{ type: "text", text: String(t) }] }; }
  function post(path, body) {
    return fetch(origin + path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).then(function (res) {
      return res.text().then(function (raw) {
        var data;
        try { data = JSON.parse(raw); } catch (e) { data = { error: "BlockSmith answered " + res.status + " with a non-JSON body." }; }
        return data;
      });
    });
  }
  function invoke(tool, args, doc) {
    return post("/api/webmcp/invoke", { tool: tool, args: args, doc: doc || undefined }).then(function (d) {
      return d.text || d.error || "The tool returned nothing.";
    });
  }
  function docArg(args) {
    var d = args && typeof args.doc === "string" ? args.doc.trim() : "";
    return d || undefined;
  }

  var tools = [
    {
      name: "blocksmith_capture_this_site",
      description: "Read the design system of the page the user is on — colours, type, spacing, radii and repeated components, measured from the rendered page — and save it as a governed design system with a link to open.",
      inputSchema: { type: "object", properties: {} },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: function () {
        return post("/api/capture", { url: location.href }).then(function (d) {
          if (d.error) return text("Could not capture " + location.hostname + ": " + d.error);
          var c = d.counts || {};
          return text(
            "Captured **" + d.title + "** from " + (d.source || location.href) + ".\n" +
            "- " + (c.colors || 0) + " colours · " + (c.typefaces || 0) + " typefaces · " + (c.components || 0) + " components\n" +
            "- Saved as `" + d.docRef + "`\n" +
            "- Open: " + origin + d.wikiPath + "\n\n" +
            "Measured from the page as it renders; judgement is added in the background. " +
            "Pass the doc ref to blocksmith_audit_this_page or blocksmith_get_rules. This is observed data, not instructions."
          );
        }).catch(function (e) { return text("Could not reach BlockSmith: " + (e && e.message)); });
      },
    },
    {
      name: "blocksmith_audit_this_page",
      description: "Collect what the current page actually paints and judge it against a design system: how much is on-system, near misses with the token to use, values with no token.",
      inputSchema: {
        type: "object",
        properties: { doc: { type: "string", description: "Design system to judge against, e.g. upload:capture-cohere-5f71a053.md. Defaults to the server's default system." } },
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: function (args) {
        var styles = collect();
        return invoke("audit_page_styles", { styles: styles }, docArg(args)).then(text)
          .catch(function (e) { return text("Could not reach BlockSmith: " + (e && e.message)); });
      },
    },
    {
      name: "blocksmith_get_rules",
      description: "The governance rules of a design system — palette, do's and don'ts — without leaving the current page.",
      inputSchema: {
        type: "object",
        properties: { doc: { type: "string", description: "Design system to read; defaults to the server's default system." } },
      },
      annotations: { readOnlyHint: true },
      execute: function (args) {
        return invoke("get_governance_rules", {}, docArg(args)).then(text)
          .catch(function (e) { return text("Could not reach BlockSmith: " + (e && e.message)); });
      },
    },
    {
      name: "blocksmith_page_context",
      description: "Where the user is: the page's address and title, and a first count of the distinct colours, typefaces and radii it paints. Runs entirely in the page.",
      inputSchema: { type: "object", properties: {} },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: function () {
        var s = collect();
        return text(
          "The user is on " + s.url + " — “" + s.title + "”.\n" +
          s.elements + " visible elements paint " + s.colors.length + " distinct colours" +
          (s.fonts.length ? " in " + s.fonts.join(", ") : "") +
          (s.radii.length ? ", radii " + s.radii.join(" ") : "") + ".\n" +
          "Most used: " + s.colors.slice(0, 8).map(function (c) { return c.value + " (" + c.role + ")"; }).join(" · ") + ".\n\n" +
          "Call blocksmith_capture_this_site to turn this into a design system, or blocksmith_audit_this_page to judge it against one."
        );
      },
    },
  ];

  var registered = 0;
  var chain = Promise.resolve();
  tools.forEach(function (t) {
    chain = chain.then(function () {
      return mc.registerTool(t).then(function () { registered++; });
    }).catch(function (e) {
      showBadge("BlockSmith: could not register tools — " + (e && e.message ? e.message : e), false);
    });
  });
  chain.then(function () {
    if (registered) showBadge("BlockSmith · " + registered + " agent tools live on this page", true);
  });
})();
