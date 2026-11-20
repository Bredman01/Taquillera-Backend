export interface Compra {
  codigo: string;
  funcionId: number;
  asientos: string[];
  total: number;
  // ISO 8601 en hora de Colombia: AAAA-MM-DDTHH:mm:ss-05:00
  fecha: string;
  nombre: string;
  correo: string;
}

// Lo que responde la API al crear una compra: sin los datos del comprador.
export type CompraCreada = Pick<
  Compra,
  'codigo' | 'funcionId' | 'asientos' | 'total' | 'fecha'
>;
