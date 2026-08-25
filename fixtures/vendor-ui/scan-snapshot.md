---
blocksmith-source: workspace-scan
workspace-root: /Users/koshish/BlockSmith/fixtures/vendor-ui
project-name: acme-ui-kit
workspace-id: acme-ui-kit
scanned-at: 2026-06-23T02:37:55.876Z
git-commit: 3ae3059
scan-paths: src
inventory-tsx: 5
inventory-files: 6
featured-components: 4
scan-facts-hash: 38e68fcafd5df8ad
---

# acme-ui-kit — Workspace Scan
> Auto-generated from repository files. Pipeline: **scan → classify → wiki** (designer-facing components only). Re-run `scan_workspace` or `npm run scan` to refresh.

## Scan metadata

- **Workspace:** `/Users/koshish/BlockSmith/fixtures/vendor-ui`
- **Scanned:** 2026-06-23T02:37:55.876Z
- **Scan paths:** `src`
- **Files read:** 6 (5 React, 8 CSS vars, 1 CSS rules, 0 utility classes, 14 hex entries)
- **Featured components:** 4 of 5 React files
- **Codebase inventory:** complete — see section below for every React file
- **Git commit:** `3ae3059`

## 1. Existing design documents

- `DESIGN.md` (375 bytes) — present in workspace; not merged automatically.
- `design.md` (375 bytes) — present in workspace; not merged automatically.

## 2. Design Tokens

### 2.1 CSS variables

| Token | Value | Source |
|-------|-------|--------|
| `--acme-accent` | #e85d4a | `src/app/globals.css` |
| `--acme-accent-muted` | #f4a99a | `src/app/globals.css` |
| `--acme-radius-md` | 8px | `src/app/globals.css` |
| `--acme-space-4` | 16px | `src/app/globals.css` |
| `--acme-surface-1` | #faf8f6 | `src/app/globals.css` |
| `--acme-surface-2` | #efeae4 | `src/app/globals.css` |
| `--acme-text` | #1a1a1a | `src/app/globals.css` |
| `--acme-text-muted` | #6b6b6b | `src/app/globals.css` |

### 2.2 Colors (hex found in workspace)

| Hex | Occurrences | Sources |
|-----|-------------|---------|
| #1a1a1a | 2 | `src/app/globals.css`, `src/app/globals.css (--acme-text)` |
| #6b6b6b | 2 | `src/app/globals.css`, `src/app/globals.css (--acme-text-muted)` |
| #88ppxx | 1 | `src/app/globals.css (--acme-radius-md)` |
| #e85d4a | 2 | `src/app/globals.css`, `src/app/globals.css (--acme-accent)` |
| #efeae4 | 2 | `src/app/globals.css`, `src/app/globals.css (--acme-surface-2)` |
| #f4a99a | 2 | `src/app/globals.css`, `src/app/globals.css (--acme-accent-muted)` |
| #faf8f6 | 2 | `src/app/globals.css`, `src/app/globals.css (--acme-surface-1)` |
| #ffffff | 1 | `src/components/ui/Button.tsx` |

### 2.3 CSS classes & styles

_Class and element rules from `.css` / `.scss` — buttons, typography, layout._

| Selector | Styles | Source |
|----------|--------|--------|
| `:root` | `--acme-accent: #e85d4a; --acme-accent-muted: #f4a99a; --acme-surface-1: #faf8f6; --acme-surface-2: #efeae4; --acme-text: #1a1a1a; --acme-text-muted: #6b6b6b; --acme-radius-md: 8px; --acme-space-4: 16px;` | `src/app/globals.css` |

## 3. Component Library

_**4** component(s) included after catalog classification. 0 file(s) scanned but excluded (rendering infra, app chrome, utilities)._

### Badge

**Role:** Reusable UI primitive: Badge.

| Field | Value |
|-------|-------|
| Category | Design primitive |
| Source | `src/components/ui/Badge.tsx` |
| Exports | `Badge` |
| CSS variables | `--acme-accent-muted`, `--acme-text` |
| Props | `label: string` |

<!-- blocksmith:interface {"name":"Badge","props":[{"name":"label","type":"string","optional":false}],"extendsTypes":[],"hasChildren":false,"propsTypeName":"BadgeProps","rootElement":"span"} -->
<!-- blocksmith:source dHlwZSBCYWRnZVByb3BzID0gewogIGxhYmVsOiBzdHJpbmc7Cn07CgpleHBvcnQgZnVuY3Rpb24gQmFkZ2UoeyBsYWJlbCB9OiBCYWRnZVByb3BzKSB7CiAgcmV0dXJuICgKICAgIDxzcGFuCiAgICAgIHN0eWxlPXt7CiAgICAgICAgZGlzcGxheTogImlubGluZS1ibG9jayIsCiAgICAgICAgYmFja2dyb3VuZENvbG9yOiAidmFyKC0tYWNtZS1hY2NlbnQtbXV0ZWQpIiwKICAgICAgICBjb2xvcjogInZhcigtLWFjbWUtdGV4dCkiLAogICAgICAgIGJvcmRlclJhZGl1czogOTk5LAogICAgICAgIHBhZGRpbmc6ICI0cHggMTBweCIsCiAgICAgICAgZm9udFNpemU6IDEyLAogICAgICAgIGZvbnRXZWlnaHQ6IDYwMCwKICAgICAgfX0KICAgID4KICAgICAge2xhYmVsfQogICAgPC9zcGFuPgogICk7Cn0K -->

### Button

**Role:** Primary action

**Designer notes:**

Do not include inactive links or old dates in button copy. Keep labels current.

| Field | Value |
|-------|-------|
| Category | Design primitive |
| Source | `src/components/ui/Button.tsx` |
| Exports | `Button` |
| CSS variables | `--acme-accent`, `--acme-radius-md`, `--acme-space-4`, `--acme-surface-2`, `--acme-text` |
| Hex in file | #ffffff |
| Props | `variant?: "primary" | "secondary"` (primary · secondary) |

<!-- blocksmith:interface {"name":"Button","props":[{"name":"variant","type":"\"primary\" | \"secondary\"","optional":true,"default":"\"primary\"","variants":["primary","secondary"]}],"extendsTypes":["ButtonHTMLAttributes<HTMLButtonElement>"],"hasChildren":true,"propsTypeName":"ButtonProps","rootElement":"button"} -->
<!-- blocksmith:source aW1wb3J0IHR5cGUgeyBCdXR0b25IVE1MQXR0cmlidXRlcywgUmVhY3ROb2RlIH0gZnJvbSAicmVhY3QiOwoKdHlwZSBCdXR0b25Qcm9wcyA9IEJ1dHRvbkhUTUxBdHRyaWJ1dGVzPEhUTUxCdXR0b25FbGVtZW50PiAmIHsKICBjaGlsZHJlbjogUmVhY3ROb2RlOwogIHZhcmlhbnQ/OiAicHJpbWFyeSIgfCAic2Vjb25kYXJ5IjsKfTsKCmV4cG9ydCBmdW5jdGlvbiBCdXR0b24oeyBjaGlsZHJlbiwgdmFyaWFudCA9ICJwcmltYXJ5IiwgLi4ucmVzdCB9OiBCdXR0b25Qcm9wcykgewogIGNvbnN0IGJnID0KICAgIHZhcmlhbnQgPT09ICJwcmltYXJ5IiA/ICJ2YXIoLS1hY21lLWFjY2VudCkiIDogInZhcigtLWFjbWUtc3VyZmFjZS0yKSI7CiAgY29uc3QgY29sb3IgPSB2YXJpYW50ID09PSAicHJpbWFyeSIgPyAiI2ZmZmZmZiIgOiAidmFyKC0tYWNtZS10ZXh0KSI7CgogIHJldHVybiAoCiAgICA8YnV0dG9uCiAgICAgIHR5cGU9ImJ1dHRvbiIKICAgICAgc3R5bGU9e3sKICAgICAgICBiYWNrZ3JvdW5kQ29sb3I6IGJnLAogICAgICAgIGNvbG9yLAogICAgICAgIGJvcmRlclJhZGl1czogInZhcigtLWFjbWUtcmFkaXVzLW1kKSIsCiAgICAgICAgcGFkZGluZzogInZhcigtLWFjbWUtc3BhY2UtNCkiLAogICAgICAgIGJvcmRlcjogIm5vbmUiLAogICAgICAgIGZvbnRXZWlnaHQ6IDYwMCwKICAgICAgICBjdXJzb3I6ICJwb2ludGVyIiwKICAgICAgfX0KICAgICAgey4uLnJlc3R9CiAgICA+CiAgICAgIHtjaGlsZHJlbn0KICAgIDwvYnV0dG9uPgogICk7Cn0K -->

### Card

**Role:** Reusable UI primitive: Card.

| Field | Value |
|-------|-------|
| Category | Design primitive |
| Source | `src/components/ui/Card.tsx` |
| Exports | `Card` |
| CSS variables | `--acme-radius-md`, `--acme-space-4`, `--acme-surface-1`, `--acme-surface-2`, `--acme-text` |
| Props | `title: string` |

<!-- blocksmith:interface {"name":"Card","props":[{"name":"title","type":"string","optional":false}],"extendsTypes":[],"hasChildren":true,"propsTypeName":"CardProps","rootElement":"section"} -->
<!-- blocksmith:source aW1wb3J0IHR5cGUgeyBSZWFjdE5vZGUgfSBmcm9tICJyZWFjdCI7Cgp0eXBlIENhcmRQcm9wcyA9IHsKICB0aXRsZTogc3RyaW5nOwogIGNoaWxkcmVuOiBSZWFjdE5vZGU7Cn07CgpleHBvcnQgZnVuY3Rpb24gQ2FyZCh7IHRpdGxlLCBjaGlsZHJlbiB9OiBDYXJkUHJvcHMpIHsKICByZXR1cm4gKAogICAgPHNlY3Rpb24KICAgICAgc3R5bGU9e3sKICAgICAgICBiYWNrZ3JvdW5kQ29sb3I6ICJ2YXIoLS1hY21lLXN1cmZhY2UtMSkiLAogICAgICAgIGJvcmRlcjogIjFweCBzb2xpZCB2YXIoLS1hY21lLXN1cmZhY2UtMikiLAogICAgICAgIGJvcmRlclJhZGl1czogInZhcigtLWFjbWUtcmFkaXVzLW1kKSIsCiAgICAgICAgcGFkZGluZzogInZhcigtLWFjbWUtc3BhY2UtNCkiLAogICAgICAgIGNvbG9yOiAidmFyKC0tYWNtZS10ZXh0KSIsCiAgICAgIH19CiAgICA+CiAgICAgIDxoMiBzdHlsZT17eyBtYXJnaW46IDAsIG1hcmdpbkJvdHRvbTogMTIsIGZvbnRTaXplOiAxOCB9fT57dGl0bGV9PC9oMj4KICAgICAge2NoaWxkcmVufQogICAgPC9zZWN0aW9uPgogICk7Cn0K -->

### Input

**Role:** Reusable UI primitive: Input.

| Field | Value |
|-------|-------|
| Category | Design primitive |
| Source | `src/components/ui/Input.tsx` |
| Exports | `Input` |
| CSS variables | `--acme-radius-md`, `--acme-surface-1`, `--acme-surface-2`, `--acme-text` |
| Props | `placeholder?: string`, `value?: string` |

<!-- blocksmith:interface {"name":"Input","props":[{"name":"placeholder","type":"string","optional":true,"default":"\"Search…\""},{"name":"value","type":"string","optional":true}],"extendsTypes":[],"hasChildren":false,"propsTypeName":"InputProps","rootElement":"input"} -->
<!-- blocksmith:source dHlwZSBJbnB1dFByb3BzID0gewogIHBsYWNlaG9sZGVyPzogc3RyaW5nOwogIHZhbHVlPzogc3RyaW5nOwp9OwoKZXhwb3J0IGZ1bmN0aW9uIElucHV0KHsgcGxhY2Vob2xkZXIgPSAiU2VhcmNo4oCmIiwgdmFsdWUgfTogSW5wdXRQcm9wcykgewogIHJldHVybiAoCiAgICA8aW5wdXQKICAgICAgdHlwZT0idGV4dCIKICAgICAgdmFsdWU9e3ZhbHVlfQogICAgICBwbGFjZWhvbGRlcj17cGxhY2Vob2xkZXJ9CiAgICAgIHN0eWxlPXt7CiAgICAgICAgd2lkdGg6ICIxMDAlIiwKICAgICAgICBib3JkZXI6ICIxcHggc29saWQgdmFyKC0tYWNtZS1zdXJmYWNlLTIpIiwKICAgICAgICBib3JkZXJSYWRpdXM6ICJ2YXIoLS1hY21lLXJhZGl1cy1tZCkiLAogICAgICAgIHBhZGRpbmc6ICIxMHB4IDEycHgiLAogICAgICAgIGZvbnRTaXplOiAxNiwKICAgICAgICBjb2xvcjogInZhcigtLWFjbWUtdGV4dCkiLAogICAgICAgIGJhY2tncm91bmRDb2xvcjogInZhcigtLWFjbWUtc3VyZmFjZS0xKSIsCiAgICAgIH19CiAgICAvPgogICk7Cn0K -->

## 4. Codebase inventory

_**5** React files in scanned paths — complete coverage. Featured in Component Library: 4._

| File | Exports | Featured | Category |
|------|---------|----------|----------|
| `src/components/layout/AppShell.tsx` | `AppShell` | no | app_chrome |
| `src/components/ui/Badge.tsx` | `Badge` | yes | design_primitive |
| `src/components/ui/Button.tsx` | `Button` | yes | design_primitive |
| `src/components/ui/Card.tsx` | `Card` | yes | design_primitive |
| `src/components/ui/Input.tsx` | `Input` | yes | design_primitive |
