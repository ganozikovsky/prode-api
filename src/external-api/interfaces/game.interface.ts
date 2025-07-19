// Interfaces base de la API de Promiedos
export interface Colors {
  color: string;
  text_color: string;
}

export interface Team {
  name: string;
  short_name: string;
  url_name: string;
  id: string;
  country_id: string;
  allow_open: boolean;
  colors: Colors;
  red_cards: number;
}

export interface Status {
  enum: number;
  name: string;
  short_name: string;
  symbol_name: string;
}

export interface Game {
  id: string;
  stage_round_name: string;
  winner: number;
  teams: Team[];
  url_name: string;
  scores: number[];
  status: Status;
  start_time: string;
  game_time: number;
  game_time_to_display: string;
  game_time_status_to_display: string;
}

export interface PromiedosApiResponse {
  TTL: number;
  games: Game[];
}

// Interfaces para incluir pronósticos
export interface UserPronostic {
  id: number;
  name: string;
  email: string;
}

export interface PronosticData {
  id: number;
  externalId: string;
  userId: number;
  prediction: any; // JSON object
  createdAt: Date;
  updatedAt: Date;
  user: UserPronostic;
}

export interface GameWithPronostics extends Game {
  pronostics: PronosticData[];
  totalPronostics: number;
  // 🆕 Nuevos campos para manejo de zona horaria
  start_time_iso?: string; // Fecha/hora en formato ISO
  timezone?: string; // Zona horaria (ej: America/Argentina/Buenos_Aires)
  timezone_offset?: string; // Offset UTC (ej: -03:00)
}

export interface MatchdayResponse {
  round: number;
  roundName: string;
  totalGames: number;
  games: GameWithPronostics[];
  externalIdPattern: string;
  databaseStatus: 'available' | 'unavailable'; // 🆕 Nuevo campo
}

// 🆕 Interfaz para respuesta agrupada por fecha
export interface GroupedMatchdayResponse {
  date: string;
  matches: GameWithPronostics[];
}

// 🆕 Interfaz para respuesta completa con metadatos y agrupación por fecha
export interface EnhancedMatchdayResponse {
  round: number;
  roundName: string;
  totalGames: number;
  externalIdPattern: string;
  databaseStatus: 'available' | 'unavailable';
  gamesByDate: GroupedMatchdayResponse[];
}
