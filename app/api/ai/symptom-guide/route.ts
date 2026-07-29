import { NextResponse } from "next/server";
import { createSymptomGuide } from "../../../../lib/pawu-ai-safety";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    species?: string;
    symptomText?: string;
  };

  const symptomText = String(body.symptomText ?? "").trim();
  if (symptomText.length < 5) {
    return NextResponse.json(
      { ok: false, message: "증상을 조금 더 자세히 적어 주세요." },
      { status: 400 },
    );
  }

  const guide = createSymptomGuide({
    species: body.species,
    symptomText,
  });

  return NextResponse.json({ ok: true, guide });
}
