export type InventoryAlertSeverity = "info" | "warning" | "critical";
export type InventoryAlertType = "low_stock" | "out_of_stock" | "expiring" | "expired";
export type InventoryMovementType = "receive" | "use" | "waste" | "adjust" | "return" | "invoice_use" | "reversal";

export const inventoryAlertLabel: Record<InventoryAlertType, string> = {
  low_stock: "안전재고 부족", out_of_stock: "품절", expiring: "유효기간 임박", expired: "유효기간 만료",
};
export const movementLabel: Record<InventoryMovementType, string> = {
  receive: "입고", use: "사용", waste: "폐기", adjust: "재고 조정", return: "반품", invoice_use: "진료 자동 차감", reversal: "차감 취소",
};
