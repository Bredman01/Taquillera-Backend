import { Injectable } from '@nestjs/common';
import type { Funcion } from './entities/funcion.entity.js';
import { diaEnColombia } from './hora-colombia.js';

@Injectable()
export class FuncionesService {
  // Las del evento 4 están fuera de orden a propósito: findByEvento ordena.
  private readonly funciones: Funcion[] = [
    {
      id: 1,
      eventoId: 1,
      inicio: '2026-11-21T18:00:00-05:00',
      precio: 15000,
    },
    {
      id: 2,
      eventoId: 1,
      inicio: '2026-11-22T15:00:00-05:00',
      precio: 15000,
    },
    {
      id: 3,
      eventoId: 4,
      inicio: '2026-11-22T19:30:00-05:00',
      precio: 25000,
    },
    {
      id: 4,
      eventoId: 4,
      inicio: '2026-11-21T23:30:00-05:00',
      precio: 25000,
    },
    {
      id: 5,
      eventoId: 4,
      inicio: '2026-11-21T16:00:00-05:00',
      precio: 25000,
    },
    {
      id: 6,
      eventoId: 5,
      inicio: '2026-11-21T20:00:00-05:00',
      precio: 30000,
    },
    {
      id: 7,
      eventoId: 6,
      inicio: '2026-11-22T17:30:00-05:00',
      precio: 40000,
    },
    {
      id: 8,
      eventoId: 6,
      inicio: '2026-11-21T17:30:00-05:00',
      precio: 40000,
    },
    {
      id: 9,
      eventoId: 7,
      inicio: '2026-11-22T21:00:00-05:00',
      precio: 35000,
    },
    {
      id: 10,
      eventoId: 8,
      inicio: '2026-11-22T10:30:00-05:00',
      precio: 8000,
    },
  ];

  // Las funciones del evento, de la más próxima a la más lejana. Es una lista
  // nueva de copias, vacía si el evento no tiene funciones.
  findByEvento(eventoId: number): Funcion[] {
    return this.funciones
      .filter((funcion) => funcion.eventoId === eventoId)
      .sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio))
      .map((funcion) => ({ ...funcion }));
  }

  // `fecha` es AAAA-MM-DD; se compara con el día de Colombia de cada función.
  tieneFuncionEn(eventoId: number, fecha: string): boolean {
    return this.funciones.some(
      (funcion) =>
        funcion.eventoId === eventoId &&
        diaEnColombia(funcion.inicio) === fecha,
    );
  }
}
