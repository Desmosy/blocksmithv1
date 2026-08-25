import {
  parseScanRequest,
  runScanService,
  type ScanServiceResult,
} from "@/lib/scan/service";
import type { ClientScanPayload } from "@/lib/scan/run";
import type { ScanApiResponse } from "./types";

export type ScanApiBody = {
  workspace?: string;
  fixture?: string;
  github?: string;
  clientScan?: ClientScanPayload;
};

export async function runScanApi(
  body: ScanApiBody,
  origin: string,
): Promise<ScanApiResponse> {
  const request = parseScanRequest(body);
  const result = await runScanService(request, origin);
  return toApiResponse(result);
}

function toApiResponse(
  result: ScanServiceResult & { wikiUrl: string },
): ScanApiResponse {
  return {
    success: true,
    docRef: result.docRef,
    fileName: result.fileName,
    wikiPath: result.wikiPath,
    wikiUrl: result.wikiUrl,
    workspaceRoot: result.workspaceRoot,
    projectName: result.projectName,
    scannedAt: result.scannedAt,
    colors: result.colors,
    components: result.components,
    reactFiles: result.reactFiles,
    filesScanned: result.filesScanned,
    curated: result.curated,
    scanMode: result.scanMode,
    githubUrl: result.githubUrl,
  };
}
