export type ComponentKind =
  | "button"
  | "input"
  | "card"
  | "nav"
  | "tag"
  | "tab"
  | "hero"
  | "strip"
  | "generic";

export type ComponentVariant = "filled" | "outline" | "ghost";

/** Parsed visual spec for a design-system component (from markdown prose). */
export type ComponentSpec = {
  kind: ComponentKind;
  variant: ComponentVariant;
  backgroundColor: string;
  color: string;
  borderColor: string;
  borderWidth: string;
  borderRadius: string;
  padding: string;
  fontSize: string;
  fontWeight: string;
  fontFamily: string;
  boxShadow: string;
  label: string;
  displaySize: string | null;
  previewBg: string;
};

/** Minimal component document — host app maps its schema here. */
export type ComponentDoc = {
  id: string;
  title: string;
  role: string;
  description: string;
};

export type TextSlot = {
  id: string;
  text: string;
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  lineHeight: string;
  letterSpacing?: string;
  color: string;
  maxWidth?: number;
};

export type GalleryItem = {
  component: ComponentDoc;
  spec: ComponentSpec;
};

export type GalleryComposition = {
  systemName: string;
  docRef: string;
  previewBg: string;
  maxWidth: number;
  items: GalleryItem[];
};
