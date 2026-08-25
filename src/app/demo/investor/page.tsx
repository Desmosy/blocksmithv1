import { InvestorDemo } from "@/components/demo/InvestorDemo";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "BlockSmith — 90-second pipeline demo",
  description:
    "Design CI/CD live: staging full, lock stale. Promote with a diff, watch the lock turn green, agents re-pin.",
};

export default function InvestorDemoPage() {
  return <InvestorDemo />;
}
