export interface Funcion {
  id: number;
  eventoId: number;
  // Texto ISO 8601 con desfase, por ejemplo "2026-11-21T19:30:00-05:00".
  // No es un Date: un Date se serializa en UTC y perdería el desfase.
  inicio: string;
  // Pesos colombianos, entero.
  precio: number;
}
