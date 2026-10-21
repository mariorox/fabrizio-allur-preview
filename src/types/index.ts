export type GarmentType = 'terno' | 'blazer' | 'camisa' | 'polo' | 'calca' | 'sapato';

export type GenerationStatus = 'pending' | 'processing' | 'success' | 'failed';

export interface Atelier {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  neighborhood: string | null;
  tagline: string | null;
  bio: string | null;
  specialty: string | null;
  avatar_image: string | null;
  cover_image: string | null;
  is_active: number;
  sort_order: number;
  created_at: string;
}

export interface AtelierWithStats extends Atelier {
  fabric_count: number;
}

export interface Session {
  id: string;
  client_name: string | null;
  notes: string | null;
  current_garment: GarmentType;
  current_fabric_id: string | null;
  current_photo: string | null;
  atelier_id: string | null;
  created_at: string;
}

/** Distingue um tecido (textura repetível) de um sapato (peça única / produto). */
export type FabricKind = 'fabric' | 'shoe';

export interface Fabric {
  id: string;
  name: string;
  code: string;
  category: string | null;
  collection: string | null;
  texture_image: string;
  /** 'fabric' = textura de tecido · 'shoe' = sapato (peça única com foto do produto). */
  kind: FabricKind;
  is_active: number;
  usage_count: number;
  atelier_id: string | null;
  created_at: string;
}

/** Uma peça do "look": um tipo de roupa + o tecido escolhido para ela. */
export interface OutfitItem {
  garment_type: GarmentType;
  fabric_id: string;
  // Snapshot denormalizado do tecido (para exibição, sem novo join)
  fabric_name?: string;
  fabric_code?: string;
  fabric_texture?: string;
}

export interface Generation {
  id: string;
  session_id: string;
  fabric_id: string;          // = primeiro item (compatibilidade / joins existentes)
  garment_type: GarmentType;  // = primeiro item
  client_photo: string;       // imagem base usada (foto original OU prévia anterior)
  base_image: string | null;  // mesma base, explícita
  base_generation_id: string | null; // de qual prévia esta partiu (acumulativo)
  items: OutfitItem[];        // lista de peças aplicadas nesta geração
  result_image: string | null;
  status: GenerationStatus;
  error_message: string | null;
  created_at: string;
  // Joined fields (primeiro item)
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
  sapato: 'Sapato',
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
