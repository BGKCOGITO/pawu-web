"use client";

import ConsentChecklist, {
  type ConsentState,
} from "./ConsentChecklist";

type Props = {
  value: ConsentState;
  onChange: (next: ConsentState) => void;
  disabled?: boolean;
};

export default function HospitalSignupConsentBlock({
  value,
  onChange,
  disabled,
}: Props) {
  return (
    <ConsentChecklist
      value={value}
      onChange={onChange}
      disabled={disabled}
      hospitalMode
    />
  );
}
