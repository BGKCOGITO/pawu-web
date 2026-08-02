"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type CareItem = {
  key: string;
  href: string;
  label: string;
  title: string;
  detail: string;
  badge: string;
  tone: "coral" | "mint" | "violet" | "amber";
};

type NotificationRow = {
  id: number;
  title: string | null;
  body: string | null;
  link_url: string | null;
  read_at: string | null;
  created_at: string;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function formatDateTime(date: string, time?: string | null) {
  const parsed = new Date(`${date}T${time || "00:00"}`);
  if (Number.isNaN(parsed.getTime())) return `${date} ${time || ""}`.trim();

  return parsed.toLocaleString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: time ? "numeric" : undefined,
    minute: time ? "2-digit" : undefined,
  });
}

function isActivePrescription(item: any, today: string) {
  const startDate = item?.start_date ? String(item.start_date).slice(0, 10) : null;
  const endDate = item?.end_date ? String(item.end_date).slice(0, 10) : null;
  if (startDate && startDate > today) return false;
  return !endDate || endDate >= today;
}

const HOME_CACHE_TTL_MS = 60_000;

export default function HomeCareSummary() {
  const [items, setItems] = useState<CareItem[]>([]);
  const lastLoadedAtRef = useRef(0);

  useEffect(() => {
    let mounted = true;

    async function load(force = false) {
      if (!force && Date.now() - lastLoadedAtRef.current < HOME_CACHE_TTL_MS) return;

      const { data: auth } = await supabase.auth.getSession();
      const user = auth.session?.user;

      if (!user) {
        if (mounted) setItems([]);
        return;
      }

      const cacheKey = `pawu-home-care-v960:${user.id}`;
      if (!force) {
        try {
          const cached = JSON.parse(sessionStorage.getItem(cacheKey) || "null") as
            | { savedAt: number; items: CareItem[] }
            | null;
          if (cached && Date.now() - cached.savedAt < HOME_CACHE_TTL_MS) {
            lastLoadedAtRef.current = cached.savedAt;
            if (mounted) setItems(cached.items);
            return;
          }
        } catch {
          sessionStorage.removeItem(cacheKey);
        }
      }

      const today = new Date().toISOString().slice(0, 10);

      const [reservationResult, prescriptionResult, hospitalizationResult, notificationResult] =
        await Promise.all([
          supabase
            .from("reservations")
            .select(
              "id,reservation_date,reservation_time,status,pet_name,pets(name),hospitals(name)",
            )
            .eq("user_id", user.id)
            .gte("reservation_date", today)
            .in("status", ["requested", "approved", "in_progress"])
            .order("reservation_date", { ascending: true })
            .order("reservation_time", { ascending: true })
            .limit(30),
          supabase
            .from("reservations")
            .select(`
              id,
              pet_name,
              pets(name),
              medical_records(
                id,
                medical_prescriptions(
                  id,
                  medication_name,
                  dosage,
                  start_date,
                  end_date
                )
              )
            `)
            .eq("user_id", user.id)
            .eq("status", "completed")
            .order("reservation_date", { ascending: false })
            .limit(40),
          fetch("/api/guardian/hospitalization-updates", { cache: "no-store" }).then(
            async (response) => (response.ok ? response.json() : null),
          ),
          fetch("/api/notifications?limit=50", { cache: "no-store" }).then(
            async (response) => (response.ok ? response.json() : null),
          ),
        ]);

      const next: CareItem[] = [];

      const reservations = (reservationResult.data ?? []) as any[];
      const reservation = reservations[0];
      if (reservation) {
        const pet = one(reservation.pets as any) as any;
        const hospital = one(reservation.hospitals as any) as any;
        const reservationCount = reservations.length;

        next.push({
          key: `reservation-${reservation.id}`,
          href: "/my-reservations",
          label: "NEXT RESERVATION",
          title: `${pet?.name ?? reservation.pet_name ?? "우리 아이"} 예약이 있어요`,
          detail: `${formatDateTime(
            reservation.reservation_date,
            reservation.reservation_time,
          )} · ${hospital?.name ?? "동물병원"}`,
          badge:
            reservationCount > 1
              ? `예정 ${reservationCount}건`
              : reservation.status === "approved"
                ? "예약 확정"
                : reservation.status === "in_progress"
                  ? "진료 중"
                  : "승인 대기",
          tone: "coral",
        });
      }

      const activePrescriptions: Array<{ prescription: any; petName: string }> = [];
      const seenPrescriptionIds = new Set<string>();

      for (const row of (prescriptionResult.data ?? []) as any[]) {
        const pet = one(row.pets);
        const records = asArray(row.medical_records);

        for (const record of records) {
          for (const prescription of asArray(record?.medical_prescriptions)) {
            if (!isActivePrescription(prescription, today)) continue;

            const id = String(prescription?.id ?? "");
            if (!id || seenPrescriptionIds.has(id)) continue;
            seenPrescriptionIds.add(id);

            activePrescriptions.push({
              prescription,
              petName: pet?.name ?? row.pet_name ?? "우리 아이",
            });
          }
        }
      }

      const firstPrescription = activePrescriptions[0];
      if (firstPrescription) {
        const prescription = firstPrescription.prescription;
        next.push({
          key: `prescription-${prescription.id}`,
          href: "/medications",
          label: "MEDICATION",
          title: `${firstPrescription.petName} 복약 중`,
          detail: `${prescription.medication_name}${
            prescription.dosage ? ` · ${prescription.dosage}` : ""
          }`,
          badge:
            activePrescriptions.length > 1
              ? `복약 ${activePrescriptions.length}건`
              : prescription.end_date
                ? `${String(prescription.end_date).slice(0, 10)}까지`
                : "복약 확인",
          tone: "mint",
        });
      }

      const hospitalizationRows = Array.isArray(hospitalizationResult?.hospitalizations)
        ? hospitalizationResult.hospitalizations
        : [];
      const activeHospitalizations = hospitalizationRows.filter(
        (row: any) => row.status && row.status !== "discharged",
      );
      const activeHospitalization = activeHospitalizations[0];

      if (activeHospitalization) {
        next.push({
          key: `hospitalization-${activeHospitalization.id}`,
          href: "/inpatient-updates",
          label: "INPATIENT CARE",
          title: `${activeHospitalization.pet?.name ?? "우리 아이"} 입원 경과`,
          detail: `${activeHospitalization.hospital?.name ?? "동물병원"}에서 치료 중이에요`,
          badge:
            activeHospitalizations.length > 1
              ? `입원 ${activeHospitalizations.length}마리`
              : "입원 중",
          tone: "violet",
        });
      }

      const notifications = Array.isArray(notificationResult?.notifications)
        ? (notificationResult.notifications as NotificationRow[])
        : [];
      const unreadNotifications = notifications.filter((item) => !item.read_at);
      const latestUnread = unreadNotifications[0];

      if (latestUnread) {
        next.push({
          key: `notification-${latestUnread.id}`,
          href: latestUnread.link_url || "/notifications",
          label: "NEW NOTICE",
          title:
            unreadNotifications.length > 1
              ? `새 알림이 ${unreadNotifications.length}개 있어요`
              : latestUnread.title || "새 알림이 있어요",
          detail: latestUnread.body || latestUnread.title || "알림 내용을 확인해 주세요.",
          badge: `미확인 ${unreadNotifications.length}`,
          tone: "amber",
        });
      }

      const savedAt = Date.now();
      lastLoadedAtRef.current = savedAt;
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify({ savedAt, items: next }));
      } catch {
        // 저장 공간이 부족해도 화면 데이터는 정상 표시합니다.
      }
      if (mounted) setItems(next);
    }

    void load();

    const handleFocus = () => void load(false);
    window.addEventListener("focus", handleFocus);

    return () => {
      mounted = false;
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <section className="home-care-summary" aria-label="오늘의 돌봄 알림">
      <div className="home-care-heading">
        <div>
          <span>CARE NOW</span>
          <h2>지금 확인할 내용</h2>
        </div>
        <Link href="/notifications">알림 전체 보기 →</Link>
      </div>

      <div className="home-care-list">
        {items.map((item) => (
          <Link key={item.key} href={item.href} className={`home-care-card ${item.tone}`}>
            <div className="home-care-copy">
              <small>{item.label}</small>
              <strong>{item.title}</strong>
              <p>{item.detail}</p>
            </div>
            <div className="home-care-side">
              <span>{item.badge}</span>
              <b>→</b>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
