export type AdmissionStatus = "planned" | "admitted" | "discharged" | "cancelled";
export type SurgeryStatus = "scheduled" | "ready" | "in_progress" | "recovery" | "completed" | "cancelled";
export type TaskStatus = "pending" | "done" | "cancelled";

export type Bed = {
  id: number;
  name: string;
  ward: string | null;
  bed_type: string;
  is_active: boolean;
  occupied: boolean;
};

export type Admission = {
  id: number;
  patient_id: number | null;
  patient_name: string;
  guardian_name: string | null;
  guardian_phone: string | null;
  bed_id: number | null;
  bed_name: string | null;
  reason: string | null;
  status: AdmissionStatus;
  admitted_at: string | null;
  expected_discharge_at: string | null;
};

export type AdmissionTask = {
  id: number;
  admission_id: number;
  title: string;
  due_at: string;
  status: TaskStatus;
  assignee_name: string | null;
  note: string | null;
};

export type Surgery = {
  id: number;
  patient_id: number | null;
  patient_name: string;
  admission_id: number | null;
  title: string;
  surgeon_name: string | null;
  operating_room: string | null;
  scheduled_start: string;
  scheduled_end: string | null;
  status: SurgeryStatus;
  consent_confirmed: boolean;
  fasting_confirmed: boolean;
  preop_test_confirmed: boolean;
  anesthesia_confirmed: boolean;
  note: string | null;
};

export type DashboardPayload = {
  beds: Bed[];
  admissions: Admission[];
  tasks: AdmissionTask[];
  surgeries: Surgery[];
};
