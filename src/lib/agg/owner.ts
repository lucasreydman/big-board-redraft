import "server-only";
import { createClient } from "@/lib/supabase/server";
import { OWNER_EMAIL } from "./constants";

// The /news surface is owner-only. Everyone else is already required to be
// logged in by the proxy; this narrows it to the single owner email.
export async function isOwner(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return (user?.email ?? "").toLowerCase() === OWNER_EMAIL;
}
