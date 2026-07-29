export const MASTER_UNKNOWN = "__unknown__";
export const MASTER_CUSTOM = "__custom__";

export type MasterLookupItem = {
  id: number;
  name_ko: string;
};

export function resolveMasterSelection({
  choice,
  customValue,
  items,
  unknownText = "모름",
}: {
  choice: string;
  customValue: string;
  items: MasterLookupItem[];
  unknownText?: string;
}) {
  if (choice === MASTER_UNKNOWN) {
    return {
      id: null,
      text: unknownText,
    };
  }

  if (choice === MASTER_CUSTOM) {
    return {
      id: null,
      text: customValue.trim(),
    };
  }

  const id = Number(choice);
  const selected = items.find((item) => item.id === id);

  return {
    id: Number.isFinite(id) ? id : null,
    text: selected?.name_ko ?? "",
  };
}
