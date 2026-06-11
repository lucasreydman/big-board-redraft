import { redirect } from "next/navigation";
import { NavTabs } from "@/components/NavTabs";
import { getCurrentUserEmail } from "@/lib/data";
import { isOwner } from "@/lib/agg/owner";
import { getDashboard } from "@/lib/agg/news";
import { xConfigured } from "@/lib/agg/x";
import { NewsClient } from "./NewsClient";

// Owner-only. Cookie + service-role dependent, so always per-request.
export const dynamic = "force-dynamic";

export default async function NewsPage() {
  if (!(await isOwner())) redirect("/");

  const [email, dashboard] = await Promise.all([
    getCurrentUserEmail(),
    getDashboard(),
  ]);

  return (
    <>
      <NavTabs active="news" email={email} isOwner />
      <main className="mx-auto max-w-[1100px] px-5 py-6">
        <NewsClient
          dashboard={dashboard}
          xConfigured={xConfigured()}
          anthropicConfigured={Boolean(process.env.ANTHROPIC_API_KEY)}
        />
      </main>
    </>
  );
}
