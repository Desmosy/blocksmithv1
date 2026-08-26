export type PresetSummary = {
  fileName: string;
  name: string;
  tagline: string;
  componentCount: number;
  tokenCount: number;
  /** A few palette hexes, for the swatch strip on the preset chip. */
  swatches: string[];
  /** Component names, used to bind tool schemas to what this system offers. */
  components: string[];
  specimen: Specimen;
};

/** Everything needed to render a design system as itself. */
export type Specimen = {
  name: string;
  tagline: string;
  colors: { name: string; value: string; role: string }[];
  display: string;
  body: string;
  mono: string;
  sizes: { meta: number; body: number; subheading: number; heading: number };
  /** Ascending spacing steps, in px. */
  space: number[];
  /** Radii in px, smallest first. */
  radii: number[];
  /** Google Fonts stylesheet href for this system, when resolvable. */
  fontsHref: string | null;
};

export type Verdict =
  | { state: "idle"; text?: undefined }
  | { state: "checking"; text?: string }
  | { state: "pass"; text: string }
  | { state: "fail"; text: string }
  | { state: "error"; text: string };
