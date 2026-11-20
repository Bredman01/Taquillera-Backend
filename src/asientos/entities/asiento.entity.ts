export type EstadoAsiento = 'disponible' | 'ocupado';

// El plano es el mismo en todos los lugares: cinco filas de ocho asientos.
export const FILAS: readonly string[] = ['A', 'B', 'C', 'D', 'E'];
export const ASIENTOS_POR_FILA = 8;

export interface Asiento {
  // Fila y número juntos, por ejemplo "A1".
  id: string;
  fila: string;
  numero: number;
  estado: EstadoAsiento;
}
