import { Injectable } from '@nestjs/common';

// El único lugar del backend que lee la hora del sistema. Las pruebas lo
// reemplazan para fijar la fecha de la compra.
@Injectable()
export class Reloj {
  // Milisegundos desde 1970, como `Date.parse`.
  ahora(): number {
    return Date.now();
  }
}
