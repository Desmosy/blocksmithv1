const SUPPORTED = new Set(["COMPONENT", "COMPONENT_SET", "ELLIPSE", "FRAME", "INSTANCE", "LINE", "POLYGON", "RECTANGLE", "STAR", "TEXT", "VECTOR"]);

function proposal(node) {
  const name = node.name || node.type.toLowerCase();
  const labels = {
    COMPONENT: `Reusable ${name} component. Document its purpose, variants, states, and accessibility contract.`,
    COMPONENT_SET: `${name} component family. Confirm when each variant should be used and which variant is the default.`,
    FRAME: `${name} layout region. Confirm hierarchy, responsive behavior, and intended reading order.`,
    TEXT: `${name} content role. Confirm semantic heading/body role, truncation, and localization behavior.`,
    INSTANCE: `${name} instance. Confirm why this variant is used in this context.`,
  };
  return labels[node.type] || `${name} visual element. Confirm its semantic role and interaction behavior.`;
}

async function candidates() {
  await figma.loadAllPagesAsync();
  const roots = figma.currentPage.selection.length ? figma.currentPage.selection : figma.currentPage.children;
  const found = [];
  for (const root of roots) {
    const nodes = [root, ...(typeof root.findAll === "function" ? root.findAll((n) => SUPPORTED.has(n.type)) : [])];
    for (const node of nodes) {
      if (!SUPPORTED.has(node.type) || found.some((item) => item.id === node.id)) continue;
      found.push({ id: node.id, name: node.name, type: node.type, proposal: proposal(node), existing: node.annotations?.map((a) => a.labelMarkdown || a.label || "").filter(Boolean) || [] });
      if (found.length >= 250) return found;
    }
  }
  return found;
}

function bytesToDataUrl(bytes) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return `data:image/jpeg;base64,${btoa(binary)}`;
}

async function previewImages(items) {
  const images = [];
  for (const item of items.slice(0, 4)) {
    const node = await figma.getNodeByIdAsync(item.id);
    if (!node || typeof node.exportAsync !== "function") continue;
    try {
      const bytes = await node.exportAsync({ format: "JPG", constraint: { type: "SCALE", value: 0.75 } });
      if (bytes.length < 4_500_000) images.push(bytesToDataUrl(bytes));
    } catch {}
  }
  return images;
}

figma.showUI(__html__, { width: 460, height: 600 });
figma.ui.onmessage = async (message) => {
  if (message.type === "scan") figma.ui.postMessage({ type: "candidates", items: await candidates() });
  if (message.type === "propose") {
    try {
      const items = await candidates();
      const server = String(message.server || "").replace(/\/+$/, "");
      if (!server || !message.apiKey) throw new Error("BlockSmith server and API key are required.");
      await figma.clientStorage.setAsync("blocksmith-settings", { server, apiKey: message.apiKey });
      const response = await fetch(`${server}/api/v1/figma/annotations/propose`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${message.apiKey}` },
        body: JSON.stringify({
          nodes: items.map((item) => ({ id: item.id, name: item.name, type: item.type, existingAnnotations: item.existing })),
          images: await previewImages(items),
          projectContext: figma.root.name,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || `BlockSmith returned ${response.status}`);
      const byId = new Map(items.map((item) => [item.id, item]));
      figma.ui.postMessage({
        type: "proposals",
        model: body.model,
        items: (body.proposals || []).map((p, index) => ({
          ...p,
          key: `${p.nodeId}:${index}`,
          id: p.nodeId,
          name: byId.get(p.nodeId)?.name || p.nodeId,
          type: byId.get(p.nodeId)?.type || "NODE",
          proposal: p.labelMarkdown,
          existing: byId.get(p.nodeId)?.existing || [],
        })),
      });
    } catch (error) {
      figma.ui.postMessage({ type: "error", message: error.message || String(error) });
    }
  }
  if (message.type === "settings") {
    const settings = await figma.clientStorage.getAsync("blocksmith-settings");
    figma.ui.postMessage({ type: "settings", settings: settings || {} });
  }
  if (message.type === "apply") {
    let applied = 0;
    const categories = await figma.annotations.getAnnotationCategoriesAsync();
    for (const item of message.items || []) {
      const node = await figma.getNodeByIdAsync(item.id);
      if (!node || !SUPPORTED.has(node.type)) continue;
      const existing = node.annotations || [];
      const category = categories.find((candidate) => candidate.label?.toLowerCase() === item.category?.toLowerCase());
      const properties = (item.properties || []).map((type) => ({ type }));
      node.annotations = [...existing, {
        labelMarkdown: `## BlockSmith proposal\n${item.proposal}\n\n_Confidence: ${item.confidence || "medium"} · Source node: \`${node.id}\`_`,
        ...(category ? { categoryId: category.id } : {}),
        ...(properties.length ? { properties } : {}),
      }];
      applied += 1;
    }
    figma.notify(`BlockSmith added ${applied} annotation proposal${applied === 1 ? "" : "s"}. Review them before publishing.`);
    figma.ui.postMessage({ type: "applied", count: applied });
  }
};

figma.ui.postMessage({ type: "ready" });
