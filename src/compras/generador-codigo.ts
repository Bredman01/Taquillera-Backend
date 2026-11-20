import { randomInt } from 'node:crypto';
import { Injectable } from '@nestjs/common';

const CARACTERES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const LARGO_DEL_CODIGO = 8;

// Da el código de una compra: 8 caracteres de A-Z y 0-9. Es una clase aparte
// para que las pruebas la reemplacen y los códigos sean predecibles.
@Injectable()
export class GeneradorCodigo {
  // `randomInt` usa el generador seguro del sistema operativo.
  generar(): string {
    return Array.from({ length: LARGO_DEL_CODIGO }, () =>
      CARACTERES.charAt(randomInt(CARACTERES.length)),
    ).join('');
  }
}
