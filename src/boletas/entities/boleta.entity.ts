export type EstadoBoleta = 'valida' | 'usada';

// La compra vista desde la puerta: solo el nombre del comprador, sin sus datos
// de contacto, el total ni la función. Una boleta válida no tiene fecha de uso;
// una usada la lleva en ISO 8601 en hora de Colombia: AAAA-MM-DDTHH:mm:ss-05:00
export type Boleta = {
  codigo: string;
  titulo: string;
  inicio: string;
  lugar: string;
  ciudad: string;
  asientos: string[];
  nombre: string;
} & (
  | { estado: 'valida'; fechaUso: null }
  | { estado: 'usada'; fechaUso: string }
);
