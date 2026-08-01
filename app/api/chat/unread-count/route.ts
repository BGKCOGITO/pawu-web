import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getAuthUser, readBearer } from "@/lib/chat-access";

export async function GET(request: Request) {
  const user = await getAuthUser(readBearer(request));
  if (!user) return NextResponse.json({ count: 0 }, { status: 401 });

  const { data: conversations } = await supabaseAdmin
    .from("chat_conversations")
    .select("id")
    .eq("guardian_user_id", user.id);

  const ids = (conversations ?? []).map((row) => Number(row.id)).filter(Number.isInteger);
  if (ids.length === 0) return NextResponse.json({ count: 0 });

  const { count, error } = await supabaseAdmin
    .from("chat_messages")
    .select("id", { count: "exact", head: true })
    .in("conversation_id", ids)
    .eq("sender_type", "hospital")
    .is("read_at", null);

  if (error) return NextResponse.json({ count: 0 });
  return NextResponse.json({ count: count ?? 0 });
}
