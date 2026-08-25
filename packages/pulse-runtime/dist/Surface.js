import { jsx as _jsx } from "react/jsx-runtime";
const DEFAULT_LEVEL_BG = {
    0: "var(--pulse-surface-0, var(--acme-surface-1, #faf8f6))",
    1: "var(--pulse-surface-1, var(--acme-surface-2, #efeae4))",
    2: "var(--pulse-surface-2, var(--acme-accent-muted, #f4a99a))",
};
export function Surface({ level = 1, background, children, style, className, }) {
    return (_jsx("div", { className: className, style: {
            background: background ?? DEFAULT_LEVEL_BG[level],
            padding: "var(--pulse-space-md, var(--acme-space-4, 16px))",
            borderRadius: "var(--pulse-radius-md, var(--acme-radius-md, 8px))",
            ...style,
        }, children: children }));
}
