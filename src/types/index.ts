export type GarmentType = 'terno' | 'blazer' | 'camisa' | 'polo' | 'calca';

export type GenerationStatus = 'pending' | 'processing' | 'success' | 'failed';

export interface Session {
  id: string;
  client_name: string | null;
  notes: string | null;
  current_garment: GarmentType;
  current_fabric_id: string | null;
  current_photo: string | null;
  created_at: string;
}

export interface Fabric {
  id: string;
  name: string;
  code: string;
  category: string | null;
  collection: string | null;
  texture_image: string;
  is_active: number;
  usage_count: number;
  created_at: string;
}

export interface Generation {
  id: string;
  session_id: string;
  fabric_id: string;
  garment_type: GarmentType;
  client_photo: string;
  result_image: string | null;
  status: GenerationStatus;
  error_message: string | null;
  created_at: string;
  // Joined fields
  fabric_name?: string;
  fabric_code?: string;
  fabric_texture?: string;
}

export const GARMENT_LABELS: Record<GarmentType, string> = {
  terno: 'Terno',
  blazer: 'Blazer',
  camisa: 'Camisa',
  polo: 'Polo',
  calca: 'Calça',
};

export const FABRIC_CATEGORIES = [
  'Lã fria',
  'Lã quente',
  'Linho',
  'Algodão premium',
  'Cashmere',
  'Seda',
  'Microfibra',
  'Outro',
];
