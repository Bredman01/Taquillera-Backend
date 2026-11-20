export const ZONA_COLOMBIA = 'America/Bogota';

// La zona va escrita aquí: el resultado no depende de la zona del servidor.
// El idioma solo fija el orden de las partes; se leen por su tipo.
const formatoDelDia = new Intl.DateTimeFormat('en-US', {
  timeZone: ZONA_COLOMBIA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

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
