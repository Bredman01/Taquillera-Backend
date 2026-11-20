import { Injectable } from '@nestjs/common';
import { EventosService } from '../eventos/eventos.service.js';
import { FuncionesService } from '../funciones/funciones.service.js';
import { ASIENTOS_POR_FILA, FILAS } from './entities/asiento.entity.js';
import type { Asiento } from './entities/asiento.entity.js';
import type { FuncionConEvento } from './entities/funcion-con-evento.entity.js';

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
}
