/**
 * Structural component-interface extractor.
 *
 * Parses a single TSX/JSX source file into a {@link ComponentInterface} — the
 * props, variants, and defaults a component actually exposes — using the
 * TypeScript compiler's *syntactic* API only (no type-checker, no module
 * resolution). That keeps it fast and deterministic, and it works on a lone
 * in-memory file even when React's types aren't installed in the scanned repo.
 *
 * This IR is the foundation for faithful codegen: instead of stamping
 * `<div>{children}</div>` stubs, the generator can emit the real prop
 * signature (`variant?: "primary" | "secondary"`, `title: string`, …).
 */
import ts from "typescript";

/** One prop a component accepts. */
export interface PropSpec {
  name: string;
  /** Raw type text, e.g. `ReactNode` or `"primary" | "secondary"`. */
  type: string;
  optional: boolean;
  /** Default from the destructuring pattern (e.g. `variant = "primary"`). */
  default?: string;
  /** String-literal union members — the component's variants. */
  variants?: string[];
}

/** The structural interface of a single component. */
export interface ComponentInterface {
  /** Exported component name (e.g. `Button`). */
  name: string;
  props: PropSpec[];
  /** Non-literal props constituents, e.g. `ButtonHTMLAttributes<HTMLButtonElement>`. */
  extendsTypes: string[];
  /** True when the component renders `children`. */
  hasChildren: boolean;
  /** Named props type when one exists (e.g. `ButtonProps`). */
  propsTypeName?: string;
  /** Best-effort: the JSX host element the component renders (`button`, `section`…). */
  rootElement?: string;
}

type FnLike =
  | ts.FunctionDeclaration
  | ts.ArrowFunction
  | ts.FunctionExpression;

function isUpperName(name: string | undefined): boolean {
  return !!name && /^[A-Z]/.test(name);
}

/** A located component: its function plus any props type from a wrapper/annotation. */
interface PickedComponent {
  name: string;
  fn: FnLike;
  /** Props type from `FC<Props>` / `forwardRef<_, Props>` when the param is untyped. */
  propsTypeNode?: ts.TypeNode;
}

/** Collect every named type alias / interface body in the file for lookup. */
function indexLocalTypes(
  sf: ts.SourceFile,
): Map<string, ts.TypeNode | ts.InterfaceDeclaration> {
  const map = new Map<string, ts.TypeNode | ts.InterfaceDeclaration>();
  sf.forEachChild((node) => {
    if (ts.isTypeAliasDeclaration(node)) {
      map.set(node.name.text, node.type);
    } else if (ts.isInterfaceDeclaration(node)) {
      map.set(node.name.text, node);
    }
  });
  return map;
}

/** Props type argument from a `React.FC<Props>` / `FunctionComponent<Props>` annotation. */
function propsFromFcAnnotation(
  typeNode: ts.TypeNode | undefined,
): ts.TypeNode | undefined {
  if (!typeNode || !ts.isTypeReferenceNode(typeNode)) return undefined;
  const name = typeNode.typeName.getText().replace(/^React\./, "");
  const fcLike =
    name === "FC" ||
    name === "FunctionComponent" ||
    name === "VFC" ||
    name === "VoidFunctionComponent";
  if (fcLike && typeNode.typeArguments?.length) return typeNode.typeArguments[0];
  return undefined;
}

/**
 * Resolve a `const X = <init>` initializer to its function and (for HOC
 * wrappers) the props type. Handles arrow/function expressions directly and
 * `forwardRef` / `memo` (incl. `React.` prefix and nesting).
 */
function resolveInitializer(init: ts.Expression): {
  fn?: FnLike;
  propsTypeNode?: ts.TypeNode;
} {
  if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) {
    return { fn: init };
  }
  if (ts.isCallExpression(init)) {
    const callee = init.expression.getText().replace(/^React\./, "");
    if (callee === "forwardRef" || callee === "memo") {
      const inner = init.arguments[0] as ts.Expression | undefined;
      const ta = init.typeArguments;
      // forwardRef<Ref, Props> → props is arg 1; memo<Props> → arg 0.
      const propsTypeNode =
        callee === "forwardRef"
          ? ta && ta.length >= 2
            ? ta[1]
            : undefined
          : ta && ta.length >= 1
            ? ta[0]
            : undefined;
      if (
        inner &&
        (ts.isArrowFunction(inner) || ts.isFunctionExpression(inner))
      ) {
        return { fn: inner, propsTypeNode };
      }
      if (inner && ts.isCallExpression(inner)) {
        const nested = resolveInitializer(inner); // e.g. memo(forwardRef(...))
        return { fn: nested.fn, propsTypeNode: propsTypeNode ?? nested.propsTypeNode };
      }
    }
  }
  return {};
}

/** Find the component function we should describe (prefer `wanted` by name). */
function findComponentFn(
  sf: ts.SourceFile,
  wanted?: string,
): PickedComponent | null {
  const candidates: PickedComponent[] = [];

  const considerVar = (
    name: string | undefined,
    init: ts.Expression | undefined,
    annotation: ts.TypeNode | undefined,
  ) => {
    if (!name || !init) return;
    const { fn, propsTypeNode } = resolveInitializer(init);
    if (!fn) return;
    candidates.push({
      name,
      fn,
      propsTypeNode: propsTypeNode ?? propsFromFcAnnotation(annotation),
    });
  };

  sf.forEachChild((node) => {
    if (ts.isFunctionDeclaration(node)) {
      // Named, or anonymous `export default function () {}`.
      const isDefault = node.modifiers?.some(
        (m) => m.kind === ts.SyntaxKind.DefaultKeyword,
      );
      const name = node.name?.text ?? (isDefault ? wanted : undefined);
      if (name) candidates.push({ name, fn: node });
    } else if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name)) continue;
        considerVar(decl.name.text, decl.initializer, decl.type);
      }
    } else if (ts.isExportAssignment(node) && !node.isExportEquals) {
      // `export default <arrow|forwardRef(...)|fnExpr>`
      const { fn, propsTypeNode } = resolveInitializer(node.expression);
      if (fn && wanted) candidates.push({ name: wanted, fn, propsTypeNode });
    }
  });

  if (wanted) {
    const hit = candidates.find((c) => c.name === wanted);
    if (hit) return hit;
  }
  // Otherwise the first uppercase-named function is the component.
  return candidates.find((c) => isUpperName(c.name)) ?? candidates[0] ?? null;
}

/** Resolve a param's type node to the members + extended (non-literal) types. */
function resolvePropsType(
  typeNode: ts.TypeNode | undefined,
  locals: Map<string, ts.TypeNode | ts.InterfaceDeclaration>,
  seen = new Set<string>(),
): { members: ts.PropertySignature[]; extendsTypes: string[]; typeName?: string } {
  const members: ts.PropertySignature[] = [];
  const extendsTypes: string[] = [];
  let typeName: string | undefined;

  const visit = (node: ts.TypeNode | ts.InterfaceDeclaration | undefined) => {
    if (!node) return;

    if (ts.isInterfaceDeclaration(node)) {
      for (const m of node.members) {
        if (ts.isPropertySignature(m)) members.push(m);
      }
      // Follow `interface X extends Y, Z`: merge local bases, record externals.
      for (const clause of node.heritageClauses ?? []) {
        for (const t of clause.types) {
          const ref = t.expression.getText();
          const local = locals.get(ref);
          if (local && !seen.has(ref)) {
            seen.add(ref);
            visit(local);
          } else if (!local) {
            extendsTypes.push(t.getText());
          }
        }
      }
      return;
    }
    if (ts.isTypeLiteralNode(node)) {
      for (const m of node.members) {
        if (ts.isPropertySignature(m)) members.push(m);
      }
      return;
    }
    if (ts.isIntersectionTypeNode(node)) {
      for (const t of node.types) visit(t);
      return;
    }
    if (ts.isTypeReferenceNode(node)) {
      const ref = node.typeName.getText();
      const local = locals.get(ref);
      if (local && !seen.has(ref)) {
        seen.add(ref);
        if (!typeName) typeName = ref;
        visit(local);
      } else {
        // External type (e.g. ButtonHTMLAttributes<HTMLButtonElement>).
        extendsTypes.push(node.getText());
      }
      return;
    }
  };

  if (typeNode && ts.isTypeReferenceNode(typeNode)) {
    typeName = typeNode.typeName.getText();
  }
  visit(typeNode);
  return { members, extendsTypes, typeName };
}

/** String-literal union → its members; otherwise undefined. */
function literalUnion(type: ts.TypeNode | undefined): string[] | undefined {
  if (!type || !ts.isUnionTypeNode(type)) return undefined;
  const out: string[] = [];
  for (const t of type.types) {
    if (ts.isLiteralTypeNode(t) && ts.isStringLiteral(t.literal)) {
      out.push(t.literal.text);
    } else {
      return undefined; // not a pure string-literal union
    }
  }
  return out.length ? out : undefined;
}

/** Defaults declared in the destructuring param: `{ variant = "primary" }`. */
function destructuredDefaults(param: ts.ParameterDeclaration): Map<string, string> {
  const defaults = new Map<string, string>();
  if (param.name && ts.isObjectBindingPattern(param.name)) {
    for (const el of param.name.elements) {
      if (ts.isIdentifier(el.name) && el.initializer) {
        defaults.set(el.name.text, el.initializer.getText());
      }
    }
  }
  return defaults;
}

/** First JSX host (lowercase) element the function returns, best-effort. */
function findRootElement(fn: FnLike): string | undefined {
  let found: string | undefined;
  const walk = (node: ts.Node) => {
    if (found) return;
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText();
      if (/^[a-z]/.test(tag)) {
        found = tag;
        return;
      }
    }
    ts.forEachChild(node, walk);
  };
  if (fn.body) walk(fn.body);
  return found;
}

/**
 * Extract the structural interface of the component in `source`.
 * `componentName` biases selection when a file exports several functions.
 */
export function extractComponentInterface(
  source: string,
  fileName = "component.tsx",
  componentName?: string,
): ComponentInterface | null {
  let sf: ts.SourceFile;
  try {
    sf = ts.createSourceFile(
      fileName,
      source,
      ts.ScriptTarget.Latest,
      /* setParentNodes */ true,
      ts.ScriptKind.TSX,
    );
  } catch {
    return null;
  }

  const picked = findComponentFn(sf, componentName);
  if (!picked) return null;

  const locals = indexLocalTypes(sf);
  const param = picked.fn.parameters[0];
  // Param annotation wins; otherwise the props type from FC<>/forwardRef<>.
  const propsTypeNode = param?.type ?? picked.propsTypeNode;
  const { members, extendsTypes, typeName } = resolvePropsType(
    propsTypeNode,
    locals,
  );
  const defaults = param ? destructuredDefaults(param) : new Map<string, string>();

  const props: PropSpec[] = [];
  let hasChildren = false;
  for (const m of members) {
    if (!ts.isIdentifier(m.name) && !ts.isStringLiteral(m.name)) continue;
    const name = m.name.getText().replace(/^["']|["']$/g, "");
    if (name === "children") {
      hasChildren = true;
      continue;
    }
    const variants = literalUnion(m.type);
    props.push({
      name,
      type: m.type ? m.type.getText() : "unknown",
      optional: !!m.questionToken,
      default: defaults.get(name),
      variants,
    });
  }
  // `children` may arrive only via the destructuring pattern or extended types.
  if (!hasChildren) {
    if (defaults.has("children") || param?.name === undefined) {
      /* nothing */
    }
    if (param && ts.isObjectBindingPattern(param.name)) {
      hasChildren = param.name.elements.some(
        (el) => ts.isIdentifier(el.name) && el.name.text === "children",
      );
    }
  }

  return {
    name: picked.name,
    props: props.sort((a, b) => a.name.localeCompare(b.name)),
    extendsTypes,
    hasChildren,
    propsTypeName: typeName,
    rootElement: findRootElement(picked.fn),
  };
}
