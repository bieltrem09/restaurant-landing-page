import type { Stage, LossReason } from "./pipeline";

export type Profile = {
  user_id: string;
  nome: string;
  estudio: string;
  whatsapp: string;
  cidade_base: string;
  tom: "formal" | "equilibrado" | "descontraido";
  horario_comercial: { inicio: string; fim: string; dias: number[] };
  meta_mensal: number;
  meta_contratos: number;
  nichos_alvo: string[];
  regioes_alvo: Array<{ cidade: string; bairros: string[] }>;
  score_pesos: Record<string, number> | null;
  places_limite_mensal: number | null;
  tema: "system" | "light" | "dark";
  onboarding_concluido: boolean;
};

export type Service = {
  id: string;
  nome: string;
  nichos: string[];
  descricao: string;
  inclui: string[];
  nao_inclui: string[];
  preco_implantacao: number;
  mensalidade: number;
  prazo_dias: number;
  ativo: boolean;
};

export type PortfolioItem = { id: string; titulo: string; url: string; nicho: string; imagem: string | null; destaque: boolean };

export type Lead = {
  id: string;
  search_id: string | null;
  place_id: string;
  nome: string;
  nicho: string;
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
  lat: number | null;
  lng: number | null;
  distancia_km: number | null;
  telefone: string | null;
  telefone_internacional: string | null;
  website: string | null;
  instagram: string | null;
  rating: number | null;
  rating_count: number | null;
  maps_url: string | null;
  primary_type: string | null;
  score: number;
  faixa: "quente" | "morno" | "frio";
  pacote_sugerido_id: string | null;
  status: "novo" | "salvo" | "descartado" | "nao_contatar" | "cliente";
  enriquecimento: "pendente" | "rodando" | "feito" | "erro";
  ultima_coleta: string | null;
  ultimo_contato_em: string | null;
  criado_em: string;
};

export type LeadSignal = {
  id: string;
  lead_id: string;
  chave: string;
  valor_json: unknown;
  pontos: number;
  fonte: string;
  coletado_em: string;
};

export type Deal = {
  id: string;
  lead_id: string;
  service_id: string | null;
  etapa: Stage;
  valor_implantacao: number;
  mensalidade: number;
  probabilidade: number | null;
  entrou_na_etapa_em: string;
  proximo_followup_em: string | null;
  motivo_perda: LossReason | null;
  motivo_perda_texto: string | null;
  ganho_em: string | null;
  criado_em: string;
};

export type Interaction = {
  id: string;
  lead_id: string;
  tipo: "mensagem_enviada" | "mensagem_recebida" | "ligacao" | "audio" | "nota";
  autor: string | null;
  texto: string;
  origem: "manual" | "colado" | "print" | "ordeliry";
  confirmada: boolean;
  ocorreu_em: string;
};

export type Task = { id: string; lead_id: string | null; titulo: string; mensagem: string | null; vence_em: string; feita: boolean };

export type PlaybookEntry = { id: string; titulo: string; nicho: string | null; conteudo: string; fonte: string; aprovado: boolean };
