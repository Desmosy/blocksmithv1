import { redirect } from "next/navigation";
import { HomeStudio } from "@/components/home/HomeStudio";
import { getSupabaseUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function Home() {
  // Signed-in users get their dashboard home base; logged-out see the landing.
  let signedIn = false;
  try {
    signedIn = !!(await getSupabaseUser());
  } catch {
    /* auth not configured — show the marketing landing */
  }
  if (signedIn) redirect("/dashboard");

  return <HomeStudio />;
}
