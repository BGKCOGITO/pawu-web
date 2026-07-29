export type CentralMedication = {
  id: number;
  product_name_ko: string;
  product_name_en: string | null;
  ingredient_name_ko: string | null;
  ingredient_name_en: string | null;
  manufacturer_name: string | null;
  dosage_form: string | null;
  strength_text: string | null;
  route_hint: string | null;
  medication_category: string | null;
  is_anesthetic: boolean;
  is_controlled: boolean;
  approval_status: string | null;
};

export type HospitalMedication = {
  id: number;
  hospital_alias: string | null;
  stock_unit: string | null;
  dispensing_unit: string | null;
  storage_location: string | null;
  is_active: boolean;
  central_medications: CentralMedication | null;
};
