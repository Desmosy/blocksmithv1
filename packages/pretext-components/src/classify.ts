import type { ComponentDoc, ComponentKind } from "./types";

function corpus(component: ComponentDoc): string {
  return `${component.title} ${component.role} ${component.description}`.toLowerCase();
}

/** Map component prose to a layout frame template. */
export function classifyComponentKind(component: ComponentDoc): ComponentKind {
  const titleRole = `${component.title} ${component.role}`.toLowerCase();
  const text = corpus(component);

  const fromTitle = (): ComponentKind | null => {
    if (/\b(text input|input field|form input)\b/.test(titleRole)) return "input";
    if (/\b(navigation bar|nav bar|top-level navigation)\b/.test(titleRole)) {
      return "nav";
    }
    if (/\b(tab navigation|product switcher)\b/.test(titleRole)) return "tab";
    if (/\b(hero|halftone)\b/.test(titleRole)) return "hero";
    if (/\b(logo strip|logo bar)\b/.test(titleRole)) return "strip";
    if (/\b(card|panel|stat|blog|feature|screenshot)\b/.test(titleRole)) return "card";
    if (/\b(tag|badge)\b/.test(titleRole)) return "tag";
    if (/\b(button|cta|pill)\b/.test(titleRole)) return "button";
    return null;
  };

  const titled = fromTitle();
  if (titled) return titled;

  if (/\b(input|text field|form field)\b/.test(text)) return "input";
  if (/\b(navigation bar|nav bar|top-level navigation|sticky nav)\b/.test(text)) {
    return "nav";
  }
  if (/\b(tab navigation|product switcher|tabs?)\b/.test(text) && !/\bbutton\b/.test(text)) {
    return "tab";
  }
  if (/\b(hero|halftone|decorative brand surface)\b/.test(text)) return "hero";
  if (/\b(logo strip|logo bar|social proof strip|partner)\b/.test(text)) return "strip";
  if (/\b(card|panel|metric|stat|blog|feature|screenshot frame)\b/.test(text)) {
    return "card";
  }
  if (/\b(category tag|taxonomy tag|status badge|status indicator)\b/.test(text)) {
    return "tag";
  }
  if (/\b(button|cta|pill)\b/.test(text)) return "button";

  return "generic";
}
