// Lo que debe traer el cuerpo de POST /funciones/:id/compras. Es una interface
// y no una clase: el servicio valida a mano lo que llega.
export interface CrearCompraDto {
  asientos: string[];
  nombre: string;
  correo: string;
}
