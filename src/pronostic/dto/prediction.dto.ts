export class PredictionDto {
  scores: number[];
  scorers: {
    local?: string;    // Goleador del equipo local (opcional)
    visitor?: string;  // Goleador del equipo visitante (opcional)
  };

  // Método para convertir a objeto JSON compatible con Prisma
  toJson(): Record<string, any> {
    return {
      scores: this.scores,
      scorers: this.scorers,
    };
  }
}
