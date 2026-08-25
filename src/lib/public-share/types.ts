export type ShareBlockKind = "component" | "surface" | "color";

export type OpinionReaction = "approve" | "unsure" | "reject";

export interface ShareOpinionCounts {
  approve: number;
  unsure: number;
  reject: number;
}

export interface ShareStats {
  views: number;
  opinions: ShareOpinionCounts;
}

export interface PublicShareRecord {
  id: string;
  createdAt: string;
  docFileName: string;
  systemName: string;
  blockKind: ShareBlockKind;
  blockId: string;
  blockTitle: string;
  contentHash: string;
  enabled: boolean;
  stats: ShareStats;
}

export interface CreateShareInput {
  docFileName: string;
  blockKind: ShareBlockKind;
  blockId: string;
}

export interface RecordOpinionInput {
  reaction: OpinionReaction;
  comment?: string;
}
