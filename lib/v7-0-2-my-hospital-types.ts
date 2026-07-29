export type MyHospitalPet = {
  id: number;
  name: string;
  species: "dog" | "cat" | "other";
};

export type MyHospitalSummary = {
  relationId: number;
  petId: number;
  petName: string;
  hospitalId: number;
  hospitalName: string;
  address: string;
  phone: string | null;
  reservationEnabled: boolean;
  latitude: number | null;
  longitude: number | null;
  isPrimary: boolean;
};
