"use client";

import { useParams } from "next/navigation";
import ConversationRoom from "@/components/chat/ConversationRoom";

export default function HospitalConversationPage() {
  const params = useParams<{ id: string }>();
  return <ConversationRoom conversationId={Number(params.id)} mode="hospital" />;
}
