export class PredictionDto {
  scores: number[];
  scorers: string[];

  // Método para convertir a objeto JSON compatible con Prisma
  toJson(): Record<string, any> {
    return {
      scores: this.scores,
      scorers: this.scorers,
    };
  }
}
