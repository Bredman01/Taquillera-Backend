import { FuncionesService } from './funciones.service.js';
import { diaEnColombia } from './hora-colombia.js';
import type { Funcion } from './entities/funcion.entity.js';

// D5: en el hilo principal las pruebas corren en Asia/Tokyo, 14 h por delante
// de Colombia. La zona se asigna en vi.hoisted, que corre antes de los import:
// el formateador Intl de hora-colombia.ts se crea al importar el módulo y fija
// su zona en ese momento. Asignada en beforeAll llegaría tarde, y un
// formateador sin `timeZone` tomaría la zona de la máquina. Stryker usa hilos
// y allí asignar TZ no cambia la zona: por eso solo se fuerza en el hilo
// principal. vi.hoisted no puede usar los import del archivo, así que
// isMainThread se importa dentro.
const { zonaOriginal, zonaForzada } = await vi.hoisted(async () => {
  const { isMainThread } = await import('node:worker_threads');
  const original = process.env.TZ;
  if (isMainThread) {
    process.env.TZ = 'Asia/Tokyo';
  }
  return { zonaOriginal: original, zonaForzada: isMainThread };
});

if (zonaForzada) {
  afterAll(() => {
    if (zonaOriginal === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = zonaOriginal;
    }
  });

  it('las pruebas corren en Asia/Tokyo, fuera de la zona de Colombia', () => {
    expect(new Date('2026-11-22T03:30:00Z').getHours()).toBe(12);
  });
}

// Las diez funciones de ejemplo aprobadas en el plan (D7), en el orden de su id.
const FUNCIONES_DE_EJEMPLO: Funcion[] = [
  { id: 1, eventoId: 1, inicio: '2026-11-21T18:00:00-05:00', precio: 15000 },
  { id: 2, eventoId: 1, inicio: '2026-11-22T15:00:00-05:00', precio: 15000 },
  { id: 3, eventoId: 4, inicio: '2026-11-22T19:30:00-05:00', precio: 25000 },
  { id: 4, eventoId: 4, inicio: '2026-11-21T23:30:00-05:00', precio: 25000 },
  { id: 5, eventoId: 4, inicio: '2026-11-21T16:00:00-05:00', precio: 25000 },
  { id: 6, eventoId: 5, inicio: '2026-11-21T20:00:00-05:00', precio: 30000 },
  { id: 7, eventoId: 6, inicio: '2026-11-22T17:30:00-05:00', precio: 40000 },
  { id: 8, eventoId: 6, inicio: '2026-11-21T17:30:00-05:00', precio: 40000 },
  { id: 9, eventoId: 7, inicio: '2026-11-22T21:00:00-05:00', precio: 35000 },
  { id: 10, eventoId: 8, inicio: '2026-11-22T10:30:00-05:00', precio: 8000 },
];

// Los eventos de ejemplo van del 1 al 10; se miran hasta el 20 para que una
// función de un evento que no existe tampoco pase desapercibida.
const EVENTOS = Array.from({ length: 20 }, (_, i) => i + 1);

const ids = (funciones: Funcion[]): number[] => funciones.map((f) => f.id);

describe('FuncionesService', () => {
  let service: FuncionesService;

  const todas = (): Funcion[] =>
    EVENTOS.flatMap((eventoId) => service.findByEvento(eventoId)).sort(
      (a, b) => a.id - b.id,
    );

  beforeEach(() => {
    service = new FuncionesService();
  });

  it('findByEvento devuelve las funciones del evento ordenadas por inicio, de la más próxima a la más lejana', () => {
    // El evento 4 guarda sus funciones fuera de orden: 3, 4 y 5.
    expect(service.findByEvento(4)).toEqual([
      {
        id: 5,
        eventoId: 4,
        inicio: '2026-11-21T16:00:00-05:00',
        precio: 25000,
      },
      {
        id: 4,
        eventoId: 4,
        inicio: '2026-11-21T23:30:00-05:00',
        precio: 25000,
      },
      {
        id: 3,
        eventoId: 4,
        inicio: '2026-11-22T19:30:00-05:00',
        precio: 25000,
      },
    ]);

    // Con el 6 el orden sale de mayor a menor id y con el 1, de menor a mayor:
    // el orden es por inicio, no por id.
    expect(ids(service.findByEvento(6))).toEqual([8, 7]);
    expect(ids(service.findByEvento(1))).toEqual([1, 2]);

    // Cada lista está ordenada por instante, de la más próxima a la más lejana.
    for (const eventoId of EVENTOS) {
      const inicios = service
        .findByEvento(eventoId)
        .map((funcion) => Date.parse(funcion.inicio));
      expect(inicios, `evento ${eventoId}`).toEqual(
        [...inicios].sort((a, b) => a - b),
      );
    }
  });

  it('cada función trae exactamente id, eventoId, inicio con desfase y precio entero en pesos', () => {
    let revisadas = 0;
    for (const eventoId of EVENTOS) {
      for (const funcion of service.findByEvento(eventoId)) {
        revisadas += 1;
        expect(Object.keys(funcion).sort()).toEqual([
          'eventoId',
          'id',
          'inicio',
          'precio',
        ]);
        expect(Number.isInteger(funcion.id)).toBe(true);
        expect(funcion.id).toBeGreaterThanOrEqual(1);
        expect(funcion.eventoId).toBe(eventoId);
        expect(funcion.inicio).toMatch(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-05:00$/,
        );
        expect(Number.isNaN(Date.parse(funcion.inicio))).toBe(false);
        expect(Number.isInteger(funcion.precio)).toBe(true);
        expect(funcion.precio).toBeGreaterThan(0);
      }
    }
    expect(revisadas).toBe(10);
  });

  it('findByEvento devuelve una lista vacía si el evento no tiene funciones', () => {
    for (const eventoId of [2, 3, 9, 10, 9999]) {
      expect(service.findByEvento(eventoId), `evento ${eventoId}`).toEqual([]);
    }
  });

  it('los datos de ejemplo son las diez funciones de la tabla del plan', () => {
    expect(todas()).toEqual(FUNCIONES_DE_EJEMPLO);
  });

  it('los datos de ejemplo traen al menos tres eventos con funciones en dos días distintos y un evento sin funciones', () => {
    const conDosDias = EVENTOS.filter((eventoId) => {
      const dias = new Set(
        service.findByEvento(eventoId).map((f) => diaEnColombia(f.inicio)),
      );
      return dias.size >= 2;
    });
    expect(conDosDias.length).toBeGreaterThanOrEqual(3);

    // Un evento de la cartelera (1 a 10) sin ninguna función.
    const sinFunciones = EVENTOS.slice(0, 10).filter(
      (eventoId) => service.findByEvento(eventoId).length === 0,
    );
    expect(sinFunciones.length).toBeGreaterThanOrEqual(1);
  });

  it('modificar el resultado de findByEvento no altera los datos internos', () => {
    const lista = service.findByEvento(4);
    lista[0].precio = 1;
    lista[0].inicio = '2000-01-01T00:00:00-05:00';
    lista[0].eventoId = 99;
    lista.pop();
    lista.length = 0;

    expect(service.findByEvento(4)).toEqual([
      {
        id: 5,
        eventoId: 4,
        inicio: '2026-11-21T16:00:00-05:00',
        precio: 25000,
      },
      {
        id: 4,
        eventoId: 4,
        inicio: '2026-11-21T23:30:00-05:00',
        precio: 25000,
      },
      {
        id: 3,
        eventoId: 4,
        inicio: '2026-11-22T19:30:00-05:00',
        precio: 25000,
      },
    ]);
    expect(todas()).toEqual(FUNCIONES_DE_EJEMPLO);
    expect(service.findByEvento(4)[0]).not.toBe(service.findByEvento(4)[0]);
  });

  it('tieneFuncionEn compara el día en hora de Colombia, no en UTC ni en la hora del servidor', () => {
    const conFuncionEn = (fecha: string): number[] =>
      EVENTOS.filter((eventoId) => service.tieneFuncionEn(eventoId, fecha));

    expect(conFuncionEn('2026-11-21')).toEqual([1, 4, 5, 6]);
    expect(conFuncionEn('2026-11-22')).toEqual([1, 4, 6, 7, 8]);
    expect(conFuncionEn('2026-11-20')).toEqual([]);
    expect(conFuncionEn('2026-11-23')).toEqual([]);
    expect(conFuncionEn('2026-11-24')).toEqual([]);

    // Cada una de estas daría `true` con UTC o con la hora de Tokio.
    expect(service.tieneFuncionEn(5, '2026-11-22')).toBe(false); // 8:00 p. m. del 21; en UTC ya es 22
    expect(service.tieneFuncionEn(7, '2026-11-23')).toBe(false); // 9:00 p. m. del 22; en UTC ya es 23
    expect(service.tieneFuncionEn(8, '2026-11-23')).toBe(false); // 10:30 a. m. del 22; en Tokio ya es 23
    expect(service.tieneFuncionEn(10, '2026-11-21')).toBe(false); // el evento 10 no tiene funciones

    // Y estas son las que sí tienen función ese día.
    expect(service.tieneFuncionEn(4, '2026-11-21')).toBe(true); // 4:00 p. m. y 11:30 p. m.
    expect(service.tieneFuncionEn(4, '2026-11-22')).toBe(true); // 7:30 p. m.
    expect(service.tieneFuncionEn(5, '2026-11-21')).toBe(true);
    expect(service.tieneFuncionEn(8, '2026-11-22')).toBe(true);
    expect(service.tieneFuncionEn(7, '2026-11-22')).toBe(true);

    // Un evento que no existe no tiene funciones ningún día.
    expect(service.tieneFuncionEn(9999, '2026-11-21')).toBe(false);
  });
});
