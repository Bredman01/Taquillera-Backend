export const ZONA_COLOMBIA = 'America/Bogota';

// La zona va escrita aquí: el resultado no depende de la zona del servidor.
// El idioma solo fija el orden de las partes; se leen por su tipo.
const formatoDelDia = new Intl.DateTimeFormat('en-US', {
  timeZone: ZONA_COLOMBIA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

// Igual que el anterior, con la hora. `hourCycle: 'h23'` escribe la medianoche
// como 00 (con `hour12: false` algunos motores dan 24).
const formatoDeFechaYHora = new Intl.DateTimeFormat('en-US', {
  timeZone: ZONA_COLOMBIA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

// Colombia no tiene horario de verano: el desfase es siempre este.
const DESFASE_DE_COLOMBIA = '-05:00';

// Día de Colombia (AAAA-MM-DD) de una hora ISO 8601 con desfase. Parte del
// instante, no del texto, así que sirve con cualquier desfase.
export function diaEnColombia(inicio: string): string {
  const partes = Object.fromEntries(
    formatoDelDia
      .formatToParts(Date.parse(inicio))
      .map((parte) => [parte.type, parte.value]),
  );
  return `${partes.year}-${partes.month}-${partes.day}`;
}

// Fecha y hora de Colombia (AAAA-MM-DDTHH:mm:ss-05:00) de un instante en
// milisegundos. Sin milisegundos: se descartan, no se redondean.
export function fechaHoraEnColombia(instante: number): string {
  const partes = Object.fromEntries(
    formatoDeFechaYHora
      .formatToParts(instante)
      .map((parte) => [parte.type, parte.value]),
  );
  return `${partes.year}-${partes.month}-${partes.day}T${partes.hour}:${partes.minute}:${partes.second}${DESFASE_DE_COLOMBIA}`;
}
