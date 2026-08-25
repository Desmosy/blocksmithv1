/**
 * Streamline Core Line icons — https://www.streamlinehq.com/icons/core-line
 * Pack: @icon-pkg/streamline-core-line-free (CC BY 4.0, see node_modules attribution)
 */
import type { FC, SVGProps } from "react";

import SvgArrowRoundRight from "@icon-pkg/streamline-core-line-free/icons/arrow-round-right.svg";
import SvgArrowUp1 from "@icon-pkg/streamline-core-line-free/icons/arrow-up-1.svg";
import SvgBrightness1 from "@icon-pkg/streamline-core-line-free/icons/brightness-1.svg";
import SvgCheck from "@icon-pkg/streamline-core-line-free/icons/check.svg";
import SvgCog from "@icon-pkg/streamline-core-line-free/icons/cog.svg";
import SvgColorPalette from "@icon-pkg/streamline-core-line-free/icons/color-palette.svg";
import SvgDarkDisplayMode from "@icon-pkg/streamline-core-line-free/icons/dark-dislay-mode.svg";
import SvgDelete1 from "@icon-pkg/streamline-core-line-free/icons/delete-1.svg";
import SvgDownloadFile from "@icon-pkg/streamline-core-line-free/icons/download-file.svg";
import SvgExpandWindow2 from "@icon-pkg/streamline-core-line-free/icons/expand-window-2.svg";
import SvgLayoutWindow1 from "@icon-pkg/streamline-core-line-free/icons/layout-window-1.svg";
import SvgLinkChain from "@icon-pkg/streamline-core-line-free/icons/link-chain.svg";
import SvgMagnifyingGlass from "@icon-pkg/streamline-core-line-free/icons/magnifying-glass.svg";
import SvgModulePuzzle1 from "@icon-pkg/streamline-core-line-free/icons/module-puzzle-1.svg";
import SvgModulePuzzle3 from "@icon-pkg/streamline-core-line-free/icons/module-puzzle-3.svg";
import SvgNewsPaper from "@icon-pkg/streamline-core-line-free/icons/news-paper.svg";
import SvgPadlockSquare1 from "@icon-pkg/streamline-core-line-free/icons/padlock-square-1.svg";
import SvgPaperclip1 from "@icon-pkg/streamline-core-line-free/icons/paperclip-1.svg";
import SvgUploadFile from "@icon-pkg/streamline-core-line-free/icons/upload-file.svg";

export type StreamlineIconProps = SVGProps<SVGSVGElement> & {
  /** Render size in px (Core Line grid is 14×14). */
  size?: number;
};

function sized(Icon: FC<SVGProps<SVGSVGElement>>, displayName: string) {
  function StreamlineSized({
    size = 14,
    width,
    height,
    className,
    ...props
  }: StreamlineIconProps) {
    return (
      <Icon
        width={width ?? size}
        height={height ?? size}
        className={className}
        aria-hidden={props["aria-label"] ? undefined : true}
        {...props}
      />
    );
  }
  StreamlineSized.displayName = displayName;
  return StreamlineSized;
}

export const IconArrowRight = sized(SvgArrowRoundRight, "IconArrowRight");
export const IconArrowUp = sized(SvgArrowUp1, "IconArrowUp");
export const IconBrightness = sized(SvgBrightness1, "IconBrightness");
export const IconCheck = sized(SvgCheck, "IconCheck");
export const IconCog = sized(SvgCog, "IconCog");
export const IconColorPalette = sized(SvgColorPalette, "IconColorPalette");
export const IconDarkMode = sized(SvgDarkDisplayMode, "IconDarkMode");
export const IconDelete = sized(SvgDelete1, "IconDelete");
export const IconDownload = sized(SvgDownloadFile, "IconDownload");
export const IconExpand = sized(SvgExpandWindow2, "IconExpand");
export const IconLayout = sized(SvgLayoutWindow1, "IconLayout");
export const IconLink = sized(SvgLinkChain, "IconLink");
export const IconLock = sized(SvgPadlockSquare1, "IconLock");
export const IconModule = sized(SvgModulePuzzle1, "IconModule");
export const IconModuleAlt = sized(SvgModulePuzzle3, "IconModuleAlt");
export const IconNewspaper = sized(SvgNewsPaper, "IconNewspaper");
export const IconPaperclip = sized(SvgPaperclip1, "IconPaperclip");
export const IconSearch = sized(SvgMagnifyingGlass, "IconSearch");
export const IconUpload = sized(SvgUploadFile, "IconUpload");

/** Block type → Core Line glyph */
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
