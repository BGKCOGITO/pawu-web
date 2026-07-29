export type PaymentMethod = "cash" | "card" | "transfer" | "other";
export type InvoiceStatus = "draft" | "payment_pending" | "partially_paid" | "paid" | "cancelled" | "refunded";
export const paymentMethodLabel: Record<PaymentMethod, string> = { cash: "현금", card: "카드", transfer: "계좌이체", other: "기타" };
export const invoiceStatusLabel: Record<InvoiceStatus, string> = { draft: "작성 중", payment_pending: "결제 대기", partially_paid: "부분 결제", paid: "결제 완료", cancelled: "취소", refunded: "환불" };
