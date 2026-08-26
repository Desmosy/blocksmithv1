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
};

export type Verdict =
  | { state: "idle"; text?: undefined }
  | { state: "checking"; text?: string }
  | { state: "pass"; text: string }
  | { state: "fail"; text: string }
  | { state: "error"; text: string };
