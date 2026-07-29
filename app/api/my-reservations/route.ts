import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabase-admin";

type RequestBody = {
  phone?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;
    const phone = String(body.phone ?? "").trim();

    if (!phone) {
      return NextResponse.json(
        {
          error: "연락처를 입력해 주세요.",
        },
        {
          status: 400,
        }
      );
    }

    const normalizedPhone = phone.replace(/[^0-9]/g, "");

    if (normalizedPhone.length < 10) {
      return NextResponse.json(
        {
          error: "올바른 연락처를 입력해 주세요.",
        },
        {
          status: 400,
        }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("reservations")
      .select(
        `
          id,
          hospital_id,
          pet_name,
          guardian_name,
          phone,
          reservation_date,
          reservation_time,
          visit_reason,
          symptoms,
          status,
          created_at
        `
      )
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error("예약 조회 오류:", error);

      return NextResponse.json(
        {
          error: "예약 내역을 불러오지 못했습니다.",
        },
        {
          status: 500,
        }
      );
    }

    const reservations = (data ?? []).filter((reservation) => {
      const savedPhone = String(
        reservation.phone ?? ""
      ).replace(/[^0-9]/g, "");

      return savedPhone === normalizedPhone;
    });

    return NextResponse.json({
      reservations,
    });
  } catch (error) {
    console.error("예약 조회 처리 오류:", error);

    return NextResponse.json(
      {
        error: "예약 조회 중 오류가 발생했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}