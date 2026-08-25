import { DeviceSimDemo } from "@/components/demo/DeviceSimDemo";
import { ensureDocBlocks } from "@/lib/blocks/refresh";
import { getDefaultDocFileName } from "@/lib/clients/registry";
import { getOfficialGraph } from "@/lib/ir/registry";
import { emitTokensHeader } from "@/lib/ir/targets/c-header";
import {
  compileDeviceSim,
  DEVICE_FRAMES,
} from "@/lib/ir/targets/device-sim";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Device simulator — blocksmith.blocks.v1 on embedded frames",
  description:
    "The same promoted block graph the wiki renders, compiled to watch/HMI device profiles with locked versions and governance constraints.",
};

export default async function DeviceDemoPage({
  searchParams,
}: {
  searchParams: Promise<{ doc?: string }>;
}) {
  const params = await searchParams;
  const doc = params.doc?.trim() || process.env.BLOCKSMITH_DOC?.trim() || getDefaultDocFileName();

  let profiles: ReturnType<typeof compileDeviceSim>[] = [];
  let tokensHeader = "";
  try {
    ensureDocBlocks(doc);
    const graph = getOfficialGraph(doc);
    profiles = DEVICE_FRAMES.map((f) => compileDeviceSim(graph, f.id));
    tokensHeader = emitTokensHeader(graph);
  } catch (err) {
    console.warn("[demo/device] compile failed:", err);
  }

  return <DeviceSimDemo profiles={profiles} tokensHeader={tokensHeader} />;
}
