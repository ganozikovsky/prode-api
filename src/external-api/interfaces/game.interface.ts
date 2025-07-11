export interface Team {
  id: string;
  name: string;
  short_name: string;
  url_name: string;
  country_id: string;
  allow_open: boolean;
  colors: {
    color: string;
    text_color: string;
  };
  red_cards: number;
}

export interface GameStatus {
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
  status: GameStatus;
  start_time: string;
  game_time: number;
  game_time_to_display: string;
  game_time_status_to_display: string;
}

export interface PromiedosApiResponse {
  TTL: number;
  games: Game[];
}

export interface ProcessedGame {
  id: string;
  date: string;
  home: {
    id: string;
    name: string;
    shortName: string;
    colors: {
      color: string;
      textColor: string;
    };
  };
  away: {
    id: string;
    name: string;
    shortName: string;
    colors: {
      color: string;
      textColor: string;
    };
  };
  status: 'scheduled' | 'playing' | 'finished';
  winner: number;
  round: string;
}

export interface ProcessedRoundData {
  round: number;
  roundName: string;
  totalGames: number;
  games: ProcessedGame[];
  externalId: string;
}
