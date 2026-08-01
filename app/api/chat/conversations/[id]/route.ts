import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { canAccessConversation, getAuthUser, readBearer } from "@/lib/chat-access";

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser(readBearer(request));
  if (!user) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id } = await params;
  const conversationId = Number(id);
  if (!Number.isInteger(conversationId)) {
    return NextResponse.json({ message: "채팅방 정보가 올바르지 않습니다." }, { status: 400 });
  }

  const access = await canAccessConversation(conversationId, user.id);
  if (!access) {
    return NextResponse.json({ message: "채팅방 접근 권한이 없습니다." }, { status: 403 });
  }

  const [{ data: conversation, error: conversationError }, { data: messages, error: messagesError }] = await Promise.all([
    supabaseAdmin
      .from("chat_conversations")
      .select(`
        id,reservation_id,status,last_message_at,guardian_user_id,hospital_id,pet_id,
        hospitals(name),
        pets(id,name,species,breed,birth_date,gender,weight_kg,notes),
        reservations(
          guardian_name,phone,reservation_date,reservation_time,status,visit_reason,symptoms,
          visit_preparations(
            id,main_concern,generated_summary,generated_timeline,generated_key_points,
            visit_preparation_events(
              sort_order,
              pet_health_events(id,occurred_at,event_type,title,severity,priority,count_value,note)
            )
          )
        )
      `)
      .eq("id", conversationId)
      .single(),
    supabaseAdmin
      .from("chat_messages")
      .select("id,sender_user_id,sender_type,message_type,content,file_name,public_url,mime_type,created_at,read_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(500),
  ]);

  if (conversationError || messagesError || !conversation) {
    return NextResponse.json(
      { message: conversationError?.message ?? messagesError?.message ?? "채팅을 불러오지 못했습니다." },
      { status: 500 },
    );
  }

  const typedConversation = conversation as any;
  const reservation = one<any>(typedConversation.reservations);
  const pet = one<any>(typedConversation.pets);
  const preparation = one<any>(reservation?.visit_preparations);
  const linkedEvents = (preparation?.visit_preparation_events ?? [])
    .map((row: any) => one<any>(row.pet_health_events))
    .filter(Boolean);

  const [profileResult, emrResult, medicalResult, recentEventsResult] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("display_name,phone")
      .eq("id", typedConversation.guardian_user_id)
      .maybeSingle(),
    supabaseAdmin
      .from("emr_records")
      .select("id,status,diagnosis_summary,treatment_summary,guardian_summary,assessment,plan,finalized_at,created_at")
      .eq("hospital_id", typedConversation.hospital_id)
      .eq("pet_id", typedConversation.pet_id)
      .order("created_at", { ascending: false })
      .limit(5),
    supabaseAdmin
      .from("medical_records")
      .select("id,chief_complaint,diagnosis,treatment,follow_up,status,completed_at,created_at")
      .eq("hospital_id", typedConversation.hospital_id)
      .eq("pet_id", typedConversation.pet_id)
      .order("created_at", { ascending: false })
      .limit(5),
    supabaseAdmin
      .from("pet_health_events")
      .select("id,occurred_at,event_type,title,severity,priority,count_value,note")
      .eq("pet_id", typedConversation.pet_id)
      .eq("user_id", typedConversation.guardian_user_id)
      .order("occurred_at", { ascending: false })
      .limit(10),
  ]);

  return NextResponse.json({
    conversation,
    messages: messages ?? [],
    actorType: access.actorType,
    userId: user.id,
    context: {
      guardian: {
        name: reservation?.guardian_name ?? profileResult.data?.display_name ?? "보호자",
        phone: reservation?.phone ?? profileResult.data?.phone ?? null,
      },
      pet,
      reservation: reservation
        ? {
            visit_reason: reservation.visit_reason,
            symptoms: reservation.symptoms,
            preparation_summary: preparation?.generated_summary ?? null,
          }
        : null,
      linkedEvents,
      recentEvents: recentEventsResult.data ?? [],
      emrRecords: emrResult.data ?? [],
      medicalRecords: medicalResult.data ?? [],
    },
  });
}
