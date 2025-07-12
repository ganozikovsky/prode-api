/**
 * 🕒 Utilidades para manejo de fechas y horarios
 * Funciones reutilizables para el sistema de pronósticos
 */

/**
 * 📅 Extrae día y hora de un string de fecha en formato "DD-MM-YYYY HH:MM"
 * Retorna formato "DiaSemana-HH:MM" para comparación
 */
export function extractDayAndHour(startTime: string): string | null {
  try {
    // Formato esperado: "13-07-2025 15:30"
    const regex = /(\d{1,2})-(\d{1,2})-(\d{4})\s+(\d{1,2}):(\d{2})/;
    const dateTimeMatch = regex.exec(startTime);
    if (!dateTimeMatch) return null;

    const [, day, month, year, hour, minute] = dateTimeMatch;

    // Crear objeto Date para obtener día de la semana
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const dayName = dayNames[date.getDay()];

    // Formato: "Sáb-15:30"
    return `${dayName}-${hour.padStart(2, '0')}:${minute}`;
  } catch (error) {
    return null;
  }
}

/**
 * 📊 Calcula estadísticas básicas de un array de horarios
 */
export function calculateScheduleStats(schedules: string[]): {
  unique: number;
  total: number;
  mostCommon: string | null;
  distribution: Record<string, number>;
} {
  const distribution: Record<string, number> = {};

  schedules.forEach((schedule) => {
    distribution[schedule] = (distribution[schedule] || 0) + 1;
  });

  const entries = Object.entries(distribution);
  const mostCommon =
    entries.length > 0
      ? entries.reduce((a, b) => (a[1] > b[1] ? a : b), entries[0])[0]
      : null;

  return {
    unique: Object.keys(distribution).length,
    total: schedules.length,
    mostCommon,
    distribution,
  };
}

/**
 * 🎯 Convierte timestamp de Argentina a UTC
 */
export function argentinaToUTC(dateString: string): Date | null {
  try {
    // Formato esperado: "13-07-2025 15:30"
    const regex = /(\d{1,2})-(\d{1,2})-(\d{4})\s+(\d{1,2}):(\d{2})/;
    const match = regex.exec(dateString);
    if (!match) return null;

    const [, day, month, year, hour, minute] = match;

    // Crear fecha en timezone de Argentina (UTC-3)
    const argDate = new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(minute),
    );

    // Ajustar a UTC (sumar 3 horas)
    return new Date(argDate.getTime() + 3 * 60 * 60 * 1000);
  } catch (error) {
    return null;
  }
}
