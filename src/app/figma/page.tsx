import { FigmaConnectCard } from "@/components/figma/FigmaConnectCard";

export const metadata = {
  title: "Import from Figma — BlockSmith",
};

export default function FigmaConnectPage() {
  return (
    <main className="min-h-screen bg-[#f5f6fa] px-6 py-16">
      <FigmaConnectCard />
    </main>
  );
}
