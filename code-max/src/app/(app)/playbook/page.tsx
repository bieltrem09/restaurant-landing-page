import type { Metadata } from "next";
import { PlaybookView } from "@/components/PlaybookView";
import { getPlaybook } from "@/lib/data";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Playbook" };

export default async function PlaybookPage() {
  const sb = await supabaseServer();
  const [entries, { data: feedback }] = await Promise.all([
    getPlaybook(sb),
    sb.from("ai_messages").select("id, feedback, feedback_texto, criado_em").eq("feedback", -1).not("feedback_texto", "is", null).order("criado_em", { ascending: false }).limit(10),
  ]);
  return <PlaybookView entries={entries} feedback={feedback ?? []} />;
}
