"use client";

import { useParams } from "next/navigation";
import ConversationRoom from "@/components/chat/ConversationRoom";

export default function GuardianConversationPage() {
  const params = useParams<{ id: string }>();
  return <ConversationRoom conversationId={Number(params.id)} mode="guardian" />;
}
