import { Injectable, Logger } from '@nestjs/common';
import { Game } from '../interfaces/game.interface';
import { extractDayAndHour } from '../utils/date-time.utils';

@Injectable()
export class MatchdayDataValidator {
  private readonly logger = new Logger(MatchdayDataValidator.name);

  /**
   * 🔍 Determina si una fecha tiene información válida (horarios reales) o genérica
   * Esta función es crucial para detectar cuando las fechas futuras se van actualizando
   */
  isRoundDataValid(games: Game[]): boolean {
    if (!games || games.length === 0) return false;

    let validGamesCount = 0;
    const totalGames = games.length;

    // 🆕 NUEVA VALIDACIÓN: Detectar horarios duplicados (señal de fecha genérica)
    const hasDistributedSchedules = this.hasDistributedSchedules(games);

    for (const game of games) {
      // ✅ Verificaciones de validez de datos
      const hasValidStartTime = this.hasValidStartTime(game.start_time);
      const hasRealisticSchedule = this.hasRealisticSchedule(game.start_time);
      const hasValidTeams = this.hasValidTeams(game.teams);

      if (hasValidStartTime && hasRealisticSchedule && hasValidTeams) {
        validGamesCount++;
      }

      this.logger.debug(
        `🔍 Partido ${game.id}: ` +
          `time=${hasValidStartTime}, schedule=${hasRealisticSchedule}, teams=${hasValidTeams} ` +
          `(${game.start_time})`,
      );
    }

    const validPercentage = (validGamesCount / totalGames) * 100;
    const hasEnoughValidGames = validPercentage >= 75; // Al menos 75% deben ser válidos

    // ✅ VALIDACIÓN FINAL: Combinar todas las verificaciones
    const isValid = hasEnoughValidGames && hasDistributedSchedules;

    this.logger.log(
      `📊 Validez de datos: ${validGamesCount}/${totalGames} válidos (${validPercentage.toFixed(1)}%), ` +
        `horarios distribuidos: ${hasDistributedSchedules ? '✅' : '❌'} - ${isValid ? '✅ VÁLIDA' : '❌ GENÉRICA'}`,
    );

    return isValid;
  }

  /**
   * 🕐 Verifica si un horario de inicio es válido (no vacío, no genérico)
   */
  hasValidStartTime(startTime: string): boolean {
    if (!startTime || startTime.trim() === '') return false;

    // Patrones de fechas genéricas comunes
    const genericPatterns = [
      '2025-01-01', // Fecha por defecto
      '01-01-2025', // Formato alternativo
      '1900-01-01', // Fecha muy antigua (placeholder)
      '2030-01-01', // Fecha muy futura (placeholder)
      '00:00', // Hora genérica
      '23:59', // Hora genérica
    ];

    return !genericPatterns.some((pattern) => startTime.includes(pattern));
  }

  /**
   * 📅 Verifica si el horario es realista para partidos de fútbol
   */
  hasRealisticSchedule(startTime: string): boolean {
    if (!startTime) return false;

    try {
      // Extraer hora del formato "DD-MM-YYYY HH:MM"
      const timeMatch = startTime.match(/(\d{1,2}):(\d{2})/);
      if (!timeMatch) return false;

      const hour = parseInt(timeMatch[1]);
      const minute = parseInt(timeMatch[2]);

      // Horarios realistas para partidos de fútbol argentino
      const isRealisticHour =
        (hour >= 14 && hour <= 22) || // 14:00 a 22:59 (horarios comunes)
        (hour === 13 && minute >= 30) || // 13:30+
        (hour === 23 && minute === 0); // 23:00 exacto

      // Minutos realistas (generalmente :00, :15, :30, :45)
      const isRealisticMinute = [0, 15, 30, 45].includes(minute);

      return isRealisticHour && isRealisticMinute;
    } catch (error) {
      return false;
    }
  }

  /**
   * 🏟️ Verifica si los equipos tienen información completa
   */
  hasValidTeams(teams: any[]): boolean {
    if (!teams || teams.length !== 2) return false;

    return teams.every(
      (team) =>
        team.name &&
        team.name.trim() !== '' &&
        team.id &&
        team.id.trim() !== '' &&
        team.short_name &&
        team.short_name.trim() !== '',
    );
  }

  /**
   * 🕰️ NUEVA VALIDACIÓN: Verifica si los horarios están distribuidos (fecha real)
   * vs todos iguales (fecha genérica)
   *
   * Lógica: Las fechas reales tienen partidos en diferentes días/horarios,
   * las genéricas suelen tener todos los partidos el mismo día y hora
   */
  private hasDistributedSchedules(games: Game[]): boolean {
    if (!games || games.length <= 1) return true; // Con 1 partido no se puede evaluar distribución

    const schedules = new Set<string>();
    const validSchedules: string[] = [];

    for (const game of games) {
      if (!game.start_time || game.start_time.trim() === '') continue;

      // Extraer día y hora del formato "DD-MM-YYYY HH:MM"
      const schedule = extractDayAndHour(game.start_time);
      if (schedule) {
        schedules.add(schedule);
        validSchedules.push(schedule);
      }
    }

    const uniqueSchedules = schedules.size;
    const totalValidSchedules = validSchedules.length;

    // 🎯 CRITERIOS para considerar distribución real:
    // 1. Al menos 2 horarios diferentes
    // 2. No más del 70% de partidos en el mismo horario
    const hasMultipleSchedules = uniqueSchedules >= 2;
    const maxSameSchedule = Math.max(
      ...Array.from(schedules).map(
        (schedule) => validSchedules.filter((s) => s === schedule).length,
      ),
    );
    const sameSchedulePercentage =
      (maxSameSchedule / totalValidSchedules) * 100;
    const isWellDistributed = sameSchedulePercentage <= 70;

    this.logger.debug(
      `📅 Análisis horarios: ${uniqueSchedules} únicos de ${totalValidSchedules} válidos, ` +
        `máximo mismo horario: ${maxSameSchedule} (${sameSchedulePercentage.toFixed(1)}%)`,
    );

    // Mostrar distribución detallada
    if (schedules.size <= 5) {
      // Solo si no hay demasiados para mostrar
      const distribution = Array.from(schedules)
        .map((schedule) => {
          const count = validSchedules.filter((s) => s === schedule).length;
          return `${schedule}(${count})`;
        })
        .join(', ');

      this.logger.debug(`🕒 Distribución: ${distribution}`);
    }

    const isDistributed = hasMultipleSchedules && isWellDistributed;

    this.logger.log(
      `🕰️ Horarios distribuidos: ${isDistributed ? '✅' : '❌'} ` +
        `(${uniqueSchedules} únicos, máx ${sameSchedulePercentage.toFixed(1)}% mismo horario)`,
    );

    return isDistributed;
  }
}
