export type TicketTier = "alto" | "medio" | "baixo";

export type Niche = {
  key: string;
  label: string;
  /** Termo usado no Text Search do Google Places. */
  query: string;
  /** includedType do Places (New), quando existe um tipo oficial. */
  placeType?: string;
  ticket: TicketTier;
  restaurante?: boolean;
  /** Janelas de menor movimento (hora local), usadas pela Ordeliry e pelos follow-ups. */
  horasCalmas: Array<[number, number]>;
};

export const NICHES: Niche[] = [
  { key: "pizzaria", label: "Pizzaria", query: "pizzaria", placeType: "pizza_restaurant", ticket: "baixo", restaurante: true, horasCalmas: [[14, 17]] },
  { key: "restaurante", label: "Restaurante", query: "restaurante", placeType: "restaurant", ticket: "medio", restaurante: true, horasCalmas: [[14, 17]] },
  { key: "hamburgueria", label: "Hamburgueria", query: "hamburgueria", placeType: "hamburger_restaurant", ticket: "baixo", restaurante: true, horasCalmas: [[14, 17]] },
  { key: "dentista", label: "Dentista", query: "dentista", placeType: "dentist", ticket: "alto", horasCalmas: [[7, 9], [12, 14]] },
  { key: "clinica", label: "Clínica", query: "clínica médica", placeType: "medical_clinic", ticket: "alto", horasCalmas: [[7, 9], [12, 14]] },
  { key: "estetica", label: "Estética", query: "clínica de estética", placeType: "beauty_salon", ticket: "alto", horasCalmas: [[7, 9], [12, 14]] },
  { key: "advogado", label: "Advocacia", query: "advogado", placeType: "lawyer", ticket: "alto", horasCalmas: [[9, 11], [14, 17]] },
  { key: "imobiliaria", label: "Imobiliária", query: "imobiliária", placeType: "real_estate_agency", ticket: "alto", horasCalmas: [[9, 11], [14, 17]] },
  { key: "corretor", label: "Corretor de imóveis", query: "corretor de imóveis", placeType: "real_estate_agency", ticket: "alto", horasCalmas: [[9, 11], [14, 17]] },
  { key: "contabilidade", label: "Contabilidade", query: "contabilidade", placeType: "accounting", ticket: "medio", horasCalmas: [[9, 11], [14, 17]] },
  { key: "academia", label: "Academia", query: "academia", placeType: "gym", ticket: "medio", horasCalmas: [[10, 12], [14, 16]] },
  { key: "petshop", label: "Pet shop", query: "pet shop", placeType: "pet_store", ticket: "medio", horasCalmas: [[10, 12], [14, 16]] },
];

export const NICHE_BY_KEY: Record<string, Niche> = Object.fromEntries(NICHES.map((n) => [n.key, n]));

export function nicheLabel(key: string): string {
  return NICHE_BY_KEY[key]?.label ?? key;
}
