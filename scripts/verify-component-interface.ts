/**
 * Verify the structural component-interface extractor across real-world shapes:
 * inline type, type alias, intersection w/ HTML attrs, `FC<Props>` + interface
 * heritage chains, `forwardRef`, `memo(arrow)`, and default exports.
 *
 * Guards faithful codegen (PROJECT-PIPELINE / Pulse): if extraction regresses,
 * the generator falls back to stubs and the "pull a real UI kit" promise breaks.
 */
import {
  extractComponentInterface,
  type ComponentInterface,
} from "../src/lib/scan/component-interface";

type Case = {
  name: string;
  source: string;
  component: string;
  expect: (i: ComponentInterface) => string | null; // null = pass
};

const has = (i: ComponentInterface, prop: string) =>
  i.props.find((p) => p.name === prop);

const cases: Case[] = [
  {
    name: "type-alias + literal-union variant + default",
    component: "Button",
    source: `import type { ButtonHTMLAttributes, ReactNode } from "react";
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: "primary" | "secondary";
};
export function Button({ children, variant = "primary", ...rest }: ButtonProps) {
  return <button {...rest}>{children}</button>;
}`,
    expect: (i) => {
      if (!i.hasChildren) return "expected children";
      if (i.rootElement !== "button") return `root=${i.rootElement}`;
      if (!i.extendsTypes.some((e) => e.includes("ButtonHTMLAttributes")))
        return "missing HTML attrs extend";
      const v = has(i, "variant");
      if (!v?.variants || v.variants.join(",") !== "primary,secondary")
        return "variant union not captured";
      if (v.default !== '"primary"') return "variant default missing";
      return null;
    },
  },
  {
    name: "FC<Props> + interface extends chain",
    component: "Panel",
    source: `import type { FC, ReactNode, HTMLAttributes } from "react";
interface BaseProps extends HTMLAttributes<HTMLDivElement> { title: string; }
interface PanelProps extends BaseProps {
  collapsed?: boolean;
  tone?: "info" | "warn" | "danger";
  children?: ReactNode;
}
export const Panel: FC<PanelProps> = ({ title, collapsed = false, tone = "info", children }) => {
  return <div>{collapsed ? title : children}</div>;
};`,
    expect: (i) => {
      if (!has(i, "title")) return "lost `title` from BaseProps";
      if (!has(i, "collapsed")) return "lost `collapsed`";
      if (!i.extendsTypes.some((e) => e.includes("HTMLAttributes")))
        return "did not follow extends to HTMLAttributes";
      const t = has(i, "tone");
      if (!t?.variants || t.variants.length !== 3) return "tone variants lost";
      if (!i.hasChildren) return "expected children";
      return null;
    },
  },
  {
    name: "forwardRef<Ref, Props>",
    component: "Field",
    source: `import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";
type FieldProps = InputHTMLAttributes<HTMLInputElement> & { size?: "sm" | "md" | "lg"; };
export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field({ size = "md", ...rest }, ref) {
  return <input ref={ref} data-size={size} {...rest} />;
});`,
    expect: (i) => {
      const s = has(i, "size");
      if (!s?.variants || s.variants.length !== 3) return "size variants lost";
      if (!i.extendsTypes.some((e) => e.includes("InputHTMLAttributes")))
        return "missing input HTML attrs";
      if (i.rootElement !== "input") return `root=${i.rootElement}`;
      return null;
    },
  },
  {
    name: "memo(arrow)",
    component: "Tag",
    source: `import { memo } from "react";
type TagProps = { label: string; color?: "gray" | "green"; };
export const Tag = memo(({ label, color = "gray" }: TagProps) => <span data-c={color}>{label}</span>);`,
    expect: (i) => {
      if (!has(i, "label")) return "lost `label`";
      const c = has(i, "color");
      if (!c?.variants) return "color variants lost";
      return null;
    },
  },
  {
    name: "default export function",
    component: "Hero",
    source: `import type { ReactNode } from "react";
type HeroProps = { headline: string; cta?: string; children?: ReactNode };
export default function Hero({ headline, cta = "Get started", children }: HeroProps) {
  return <header><h1>{headline}</h1>{children}<button>{cta}</button></header>;
}`,
    expect: (i) => {
      if (i.name !== "Hero") return `name=${i.name}`;
      if (!has(i, "headline")) return "lost `headline`";
      if (has(i, "cta")?.default !== '"Get started"') return "cta default lost";
      if (!i.hasChildren) return "expected children";
      return null;
    },
  },
];

const failures: string[] = [];
for (const c of cases) {
  const iface = extractComponentInterface(c.source, `${c.component}.tsx`, c.component);
  if (!iface) {
    failures.push(`${c.name}: extractor returned null`);
    continue;
  }
  const problem = c.expect(iface);
  if (problem) failures.push(`${c.name}: ${problem}`);
  else console.log(`  OK ${c.name}`);
}

console.log("\n[verify:component-interface]");
if (failures.length) {
  console.error("FAILED:");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`OK — ${cases.length} component shapes extract faithfully.`);
