export type ApiKeyRecord = {
  id: string;
  /** Supabase auth user id — null for legacy admin-minted keys */
  userId?: string | null;
  /** Public prefix shown in logs (bs_live_abc…) */
  prefix: string;
  /** sha256 of full secret — never store plaintext after creation */
  hash: string;
  label: string;
  createdAt: string;
  lastUsedAt?: string;
  revokedAt?: string;
};

export type ApiKeyStore = {
  version: 1;
  keys: ApiKeyRecord[];
};

export type AuthenticatedKey = {
  id: string;
  userId: string | null;
  prefix: string;
  label: string;
  /** Legacy admin keys without user binding — full access in strict mode */
  isAdmin: boolean;
};

export type ScanApiResponse = {
  success: true;
  docRef: string;
  fileName: string;
  wikiUrl: string;
  wikiPath: string;
  workspaceRoot: string;
  projectName: string;
  scannedAt: string;
  colors: number;
  components: number;
  reactFiles: number;
  filesScanned: number;
  curated: boolean;
  /** How the scan was sourced — fixture | github | workspace | clientScan */
  scanMode: string;
  githubUrl?: string;
};

export type Actor =
  | {
      kind: "user";
      userId: string;
      login: string | null;
    }
  | {
      kind: "apiKey";
      userId: string | null;
      keyId: string;
      prefix: string;
      label: string;
      isAdmin: boolean;
    };
