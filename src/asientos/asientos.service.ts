import { ConflictException, Injectable } from '@nestjs/common';
import { EventosService } from '../eventos/eventos.service.js';
import { FuncionesService } from '../funciones/funciones.service.js';
import { ASIENTOS_POR_FILA, FILAS } from './entities/asiento.entity.js';
import type { Asiento } from './entities/asiento.entity.js';
import type { FuncionConEvento } from './entities/funcion-con-evento.entity.js';

// Los ids del plano (A1 a E8), armados con las mismas constantes que usa
// findAsientos: el plano se escribe una sola vez, en asiento.entity.ts.
const IDS_DEL_PLANO: ReadonlySet<string> = new Set(
  FILAS.flatMap((fila) =>
    Array.from(
      { length: ASIENTOS_POR_FILA },
      (_, indice) => `${fila}${indice + 1}`,
    ),
  ),
);

@Injectable()
export class AsientosService {
  // Los ocupados de cada función. Una función que no aparece aquí no tiene
  // ninguno. El plano es el mismo para todas, así que no se guarda por función.
  private readonly ocupados = new Map<number, Set<string>>([
    [5, new Set(['A3', 'A4', 'C1', 'C8', 'D5', 'E8'])],
  ]);

  constructor(
    private readonly funciones: FuncionesService,
    private readonly eventos: EventosService,
  ) {}

  // La función con el título, la ciudad y el lugar de su evento. Si la función
  // no existe (o apunta a un evento que no existe) responde 404.
  findFuncion(id: number): FuncionConEvento {
    const funcion = this.funciones.findOne(id);
    const { titulo, ciudad, lugar } = this.eventos.findOne(funcion.eventoId);
    return { ...funcion, titulo, ciudad, lugar };
  }

  // Los 40 asientos del plano, de la A1 a la E8, con su estado en esta función.
  // Son objetos nuevos en cada llamada: nunca se devuelven los datos internos.
  findAsientos(funcionId: number): Asiento[] {
    this.funciones.findOne(funcionId);
    const ocupados = this.ocupados.get(funcionId);

    return FILAS.flatMap((fila) =>
      Array.from({ length: ASIENTOS_POR_FILA }, (_, indice): Asiento => {
        const numero = indice + 1;
        const id = `${fila}${numero}`;
        return {
          id,
          fila,
          numero,
          estado: ocupados?.has(id) ? 'ocupado' : 'disponible',
        };
      }),
    );
  }

  // Si el id es uno de los 40 asientos del plano. Exacto: en mayúscula, sin
  // espacios ni ceros a la izquierda. No mira si está libre u ocupado.
  existeEnElPlano(id: string): boolean {
    return IDS_DEL_PLANO.has(id);
  }

  // Ocupa todos los asientos pedidos en esa función, o ninguno: si alguno ya
  // está ocupado, responde 409 con los no disponibles (en el orden pedido) y no
  // ocupa nada. Es síncrono a propósito: entre comprobar y ocupar no hay ningún
  // `await`, así que ninguna otra compra se puede colar.
  //
  // Solo comprueba que la función existe y que los asientos están libres. Quien
  // lo llama (hoy ComprasService, con las reglas 1 a 5 del contrato) debe haber
  // comprobado antes que la lista no está vacía, que no tiene repetidos y que
  // cada id existe en el plano (`existeEnElPlano`). Si no, se guardarían ids
  // fuera del plano, el 409 podría nombrar dos veces el mismo asiento y una
  // lista vacía no haría nada.
  ocupar(funcionId: number, ids: readonly string[]): void {
    this.funciones.findOne(funcionId);
    const deLaFuncion = this.ocupados.get(funcionId) ?? new Set<string>();

    const noDisponibles = ids.filter((id) => deLaFuncion.has(id));
    if (noDisponibles.length > 0) {
      throw new ConflictException({
        statusCode: 409,
        message: `Estos asientos ya no están disponibles: ${noDisponibles.join(', ')}`,
        error: 'Conflict',
        asientos: noDisponibles,
      });
    }

    // Los ids se copian uno a uno al Set: la lista recibida no se guarda.
    for (const id of ids) {
      deLaFuncion.add(id);
    }
    this.ocupados.set(funcionId, deLaFuncion);
  }
}
