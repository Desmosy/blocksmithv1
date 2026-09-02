/**
 * The app's icon set — Iconsax (https://iconsax.io), linear weight.
 *
 * Every icon in the product resolves through this module, so the set can be
 * changed in one place rather than across the ~20 files that draw icons. The
 * export names and the `size` prop are kept from the previous set so no call
 * site had to change when the artwork did.
 *
 * Linear is deliberate: these sit inside navigation, table rows and labels,
 * where a stroked glyph reads as an affordance. The logo is the one bold mark
 * (see components/logo.tsx) so it is not mistaken for another menu item.
 */
import type { FC, SVGProps } from "react";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  ArrowUp2,
  Sun1,
  TickCircle,
  Setting2,
  ColorSwatch,
  Moon,
  Trash,
  DocumentDownload,
  Maximize4,
  Element3,
  Link2,
  Lock1,
  Component,
  Element4,
  DocumentText,
  Paperclip2,
  SearchNormal1,
  DocumentUpload,
  Home2,
  LogoutCurve,
} from "iconsax-react";

export type StreamlineIconProps = SVGProps<SVGSVGElement> & {
  /** Render size in px. */
  size?: number;
};

type IconsaxComponent = FC<{
  size?: number | string;
  color?: string;
  variant?: "Linear" | "Outline" | "Broken" | "Bold" | "Bulk" | "TwoTone";
  className?: string;
}>;

/**
 * Iconsax takes `size`/`color` rather than SVG attributes, so the wrapper
 * translates. `color` is currentColor throughout: an icon should take the text
 * colour of whatever it sits in, which is what makes one set work in both
 * themes without a per-icon dark variant.
 */
function sized(Icon: IconsaxComponent, displayName: string) {
  function IconsaxSized({ size = 16, className, style, ...props }: StreamlineIconProps) {
    return (
      <span
        // `className` belongs on this element, not on the glyph inside it.
        // Call sites position icons with utilities like `absolute left-3
        // -translate-y-1/2`; putting those on the inner svg leaves this
        // wrapper in normal flow and the icon lands beside where it should be.
        className={cn("inline-flex shrink-0 items-center justify-center", className)}
        aria-hidden={props["aria-label"] ? undefined : true}
        aria-label={props["aria-label"]}
        role={props["aria-label"] ? "img" : undefined}
        style={{ width: size, height: size, ...style }}
      >
        <Icon size={size} color="currentColor" variant="Linear" />
      </span>
    );
  }
  IconsaxSized.displayName = displayName;
  return IconsaxSized;
}

export const IconArrowRight = sized(ArrowRight as IconsaxComponent, "IconArrowRight");
export const IconArrowUp = sized(ArrowUp2 as IconsaxComponent, "IconArrowUp");
export const IconBrightness = sized(Sun1 as IconsaxComponent, "IconBrightness");
export const IconCheck = sized(TickCircle as IconsaxComponent, "IconCheck");
export const IconCog = sized(Setting2 as IconsaxComponent, "IconCog");
export const IconColorPalette = sized(ColorSwatch as IconsaxComponent, "IconColorPalette");
export const IconDarkMode = sized(Moon as IconsaxComponent, "IconDarkMode");
export const IconDelete = sized(Trash as IconsaxComponent, "IconDelete");
export const IconDownload = sized(DocumentDownload as IconsaxComponent, "IconDownload");
export const IconExpand = sized(Maximize4 as IconsaxComponent, "IconExpand");
export const IconLayout = sized(Element3 as IconsaxComponent, "IconLayout");
export const IconLink = sized(Link2 as IconsaxComponent, "IconLink");
export const IconLock = sized(Lock1 as IconsaxComponent, "IconLock");
export const IconModule = sized(Component as IconsaxComponent, "IconModule");
export const IconModuleAlt = sized(Element4 as IconsaxComponent, "IconModuleAlt");
export const IconNewspaper = sized(DocumentText as IconsaxComponent, "IconNewspaper");
export const IconPaperclip = sized(Paperclip2 as IconsaxComponent, "IconPaperclip");
export const IconSearch = sized(SearchNormal1 as IconsaxComponent, "IconSearch");
export const IconUpload = sized(DocumentUpload as IconsaxComponent, "IconUpload");
export const IconHome = sized(Home2 as IconsaxComponent, "IconHome");
export const IconSignOut = sized(LogoutCurve as IconsaxComponent, "IconSignOut");

/** Block type → glyph */
export const BLOCK_TYPE_ICON: Record<string, FC<StreamlineIconProps>> = {
  token: IconColorPalette,
  component: IconModule,
  guideline: IconNewspaper,
  "agent-rule": IconCog,
  page: IconLayout,
};

export function IconBlockType({
  type,
  ...props
}: StreamlineIconProps & { type: string }) {
  const Icon = BLOCK_TYPE_ICON[type] ?? IconModuleAlt;
  return <Icon {...props} />;
}
