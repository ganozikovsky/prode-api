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

/**
 * 🌎 Constantes de configuración de zona horaria
 */
export const TIMEZONE_CONFIG = {
  ARGENTINA: 'America/Argentina/Buenos_Aires',
  UTC_OFFSET: -3, // Argentina es UTC-3
} as const;

/**
 * 🎯 Obtiene la fecha/hora actual en Argentina
 */
export function getArgentinaNow(): Date {
  // Crear fecha actual en UTC
  const now = new Date();
  
  // Ajustar a horario de Argentina (UTC-3)
  const argentinaTime = new Date(now.getTime() - (3 * 60 * 60 * 1000));
  
  return argentinaTime;
}

/**
 * 🔄 Convierte una fecha UTC a horario de Argentina para display
 */
export function utcToArgentinaString(utcDate: Date): string {
  const argDate = new Date(utcDate.getTime() - (3 * 60 * 60 * 1000));
  
  return argDate.toLocaleString('es-AR', {
    timeZone: TIMEZONE_CONFIG.ARGENTINA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * 📅 Verifica si una fecha/hora está en el pasado (horario Argentina)
 */
export function isPastInArgentina(dateString: string): boolean {
  const targetDate = argentinaToUTC(dateString);
  if (!targetDate) return false;
  
  const nowArgentina = getArgentinaNow();
  return targetDate < nowArgentina;
}

/**
 * 🔍 Parsea y valida fechas con mejor manejo de errores
 */
export function parseArgentinaDate(dateString: string): {
  isValid: boolean;
  date: Date | null;
  error?: string;
} {
  try {
    const parsed = argentinaToUTC(dateString);
    if (!parsed) {
      return { isValid: false, date: null, error: 'Formato de fecha inválido' };
    }
    
    return { isValid: true, date: parsed };
  } catch (error) {
    return { 
      isValid: false, 
      date: null, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
}
