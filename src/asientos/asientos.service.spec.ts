import { ConflictException, NotFoundException } from '@nestjs/common';
import { EventosService } from '../eventos/eventos.service.js';
import { FuncionesService } from '../funciones/funciones.service.js';
import { AsientosService } from './asientos.service.js';

// D8: aquí no se fuerza la zona. El servicio copia `inicio` tal cual y no hace
// ningún cálculo de hora; las pruebas exigen el texto exacto con «-05:00».

// El plano del lugar, escrito a mano (D4, D5): cinco filas de ocho asientos,
// siempre en este orden. No se arma con FILAS ni con ASIENTOS_POR_FILA para que
// un error en el plano no se repita en la prueba.
const IDS_EN_ORDEN = [
  ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8'],
  ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8'],
  ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8'],
  ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8'],
  ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8'],
].flat();

// Los únicos ocupados de los datos de ejemplo (D6): los de la función 5.
const OCUPADOS_DE_LA_5 = ['A3', 'A4', 'C1', 'C8', 'D5', 'E8'];

// Las otras nueve funciones de ejemplo.
const SIN_OCUPADOS = [1, 2, 3, 4, 6, 7, 8, 9, 10];

const asientosEsperados = (ocupados: string[]) =>
  IDS_EN_ORDEN.map((id) => ({
    id,
    fila: id.slice(0, 1),
    numero: Number(id.slice(1)),
    estado: ocupados.includes(id) ? 'ocupado' : 'disponible',
  }));

const ASIENTOS_DE_LA_5 = asientosEsperados(OCUPADOS_DE_LA_5);
const ASIENTOS_LIBRES = asientosEsperados([]);

// Los ids de los asientos ocupados, en el orden del plano.
const ocupadosDe = (asientos: ReadonlyArray<{ id: string; estado: string }>) =>
  asientos
    .filter((asiento) => asiento.estado === 'ocupado')
    .map((asiento) => asiento.id);

// Ejecuta la acción y devuelve lo que lanzó. Si no lanza nada, la prueba falla:
// así un `ocupar` que no lanza, o que lanza más tarde (async), no pasa.
function lanzado(accion: () => unknown): unknown {
  try {
    accion();
  } catch (error) {
    return error;
  }
  throw new Error('Se esperaba una excepción y no se lanzó ninguna');
}

// El 409 de D5, con el cuerpo exacto que Nest devuelve tal cual.
function esperarConflicto(
  accion: () => unknown,
  mensaje: string,
  asientos: string[],
) {
  const error = lanzado(accion);
  expect(error).toBeInstanceOf(ConflictException);
  const conflicto = error as ConflictException;
  expect(conflicto.getStatus()).toBe(409);
  expect(conflicto.getResponse()).toEqual({
    statusCode: 409,
    message: mensaje,
    error: 'Conflict',
    asientos,
  });
}

const CAMPOS_DE_LA_FUNCION = [
  'ciudad',
  'eventoId',
  'id',
  'inicio',
  'lugar',
  'precio',
  'titulo',
];

describe('AsientosService', () => {
  let funciones: FuncionesService;
  let eventos: EventosService;
  let service: AsientosService;

  beforeEach(() => {
    funciones = new FuncionesService();
    eventos = new EventosService(funciones);
    service = new AsientosService(funciones, eventos);
  });

  // Los espías de una prueba no pasan a la siguiente.
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('findFuncion devuelve la función con el título, la ciudad y el lugar de su evento, y exactamente siete campos', () => {
    expect(service.findFuncion(5)).toEqual({
      id: 5,
      eventoId: 4,
      titulo: 'Cartas a Medianoche',
      ciudad: 'Neiva',
      lugar: 'Teatro Municipal de Neiva',
      inicio: '2026-11-21T16:00:00-05:00',
      precio: 25000,
    });
    expect(service.findFuncion(10)).toEqual({
      id: 10,
      eventoId: 8,
      titulo: 'Del Grano a la Taza',
      ciudad: 'Neiva',
      lugar: 'Biblioteca Departamental',
      inicio: '2026-11-22T10:30:00-05:00',
      precio: 8000,
    });
    expect(service.findFuncion(1)).toEqual({
      id: 1,
      eventoId: 1,
      titulo: 'El Último Faro',
      ciudad: 'Neiva',
      lugar: 'Cine Club La Gaitana',
      inicio: '2026-11-21T18:00:00-05:00',
      precio: 15000,
    });

    // Las diez, con exactamente los siete campos del contrato.
    for (let id = 1; id <= 10; id += 1) {
      const campos = Object.keys(service.findFuncion(id)).sort();
      expect(campos, `función ${id}`).toEqual(CAMPOS_DE_LA_FUNCION);
    }
  });

  it('findFuncion lanza NotFoundException con «La función 9999 no existe», también con 0 y -1', () => {
    for (const id of [9999, 0, -1]) {
      expect(() => service.findFuncion(id)).toThrow(NotFoundException);
      expect(() => service.findFuncion(id)).toThrow(
        new RegExp(`^La función ${id} no existe$`),
      );
    }
  });

  it('findAsientos devuelve los 40 asientos ordenados por fila y por número, con exactamente id, fila, numero y estado', () => {
    for (let funcionId = 1; funcionId <= 10; funcionId += 1) {
      const asientos = service.findAsientos(funcionId);

      expect(asientos, `función ${funcionId}`).toHaveLength(40);
      expect(
        asientos.map((asiento) => asiento.id),
        `función ${funcionId}`,
      ).toEqual(IDS_EN_ORDEN);

      for (const asiento of asientos) {
        expect(Object.keys(asiento).sort()).toEqual([
          'estado',
          'fila',
          'id',
          'numero',
        ]);
        expect(typeof asiento.id).toBe('string');
        expect(['A', 'B', 'C', 'D', 'E']).toContain(asiento.fila);
        expect(Number.isInteger(asiento.numero)).toBe(true);
        expect(asiento.numero).toBeGreaterThanOrEqual(1);
        expect(asiento.numero).toBeLessThanOrEqual(8);
        expect(asiento.id).toBe(`${asiento.fila}${asiento.numero}`);
        expect(['disponible', 'ocupado']).toContain(asiento.estado);
      }
    }
  });

  it('findAsientos marca como ocupados los seis asientos de ejemplo de la función 5 y el resto como disponibles', () => {
    const asientos = service.findAsientos(5);

    expect(
      asientos
        .filter((asiento) => asiento.estado === 'ocupado')
        .map((asiento) => asiento.id),
    ).toEqual(OCUPADOS_DE_LA_5);
    expect(
      asientos.filter((asiento) => asiento.estado === 'disponible'),
    ).toHaveLength(34);

    // `estado` solo toma esos dos valores, en minúsculas.
    const estados = new Set<string>(asientos.map((asiento) => asiento.estado));
    expect([...estados].sort()).toEqual(['disponible', 'ocupado']);

    // La lista completa, objeto por objeto.
    expect(asientos).toEqual(ASIENTOS_DE_LA_5);
    expect(asientos[2]).toEqual({
      id: 'A3',
      fila: 'A',
      numero: 3,
      estado: 'ocupado',
    });
    expect(asientos[39]).toEqual({
      id: 'E8',
      fila: 'E',
      numero: 8,
      estado: 'ocupado',
    });
    expect(asientos[0]).toEqual({
      id: 'A1',
      fila: 'A',
      numero: 1,
      estado: 'disponible',
    });
  });

  it('findAsientos lanza NotFoundException con «La función 9999 no existe», también con 0 y -1', () => {
    for (const id of [9999, 0, -1]) {
      expect(() => service.findAsientos(id)).toThrow(NotFoundException);
      expect(() => service.findAsientos(id)).toThrow(
        new RegExp(`^La función ${id} no existe$`),
      );
    }
  });

  it('los ocupados son de cada función: las otras nueve, incluidas la 3 y la 4 del mismo evento, tienen sus 40 asientos disponibles', () => {
    // La 5 se consulta primero: lo que ocupa no debe pasar a las otras.
    expect(
      service.findAsientos(5).filter((asiento) => asiento.estado === 'ocupado'),
    ).toHaveLength(6);

    for (const funcionId of SIN_OCUPADOS) {
      const asientos = service.findAsientos(funcionId);
      expect(asientos, `función ${funcionId}`).toEqual(ASIENTOS_LIBRES);
      expect(
        asientos.filter((asiento) => asiento.estado === 'ocupado'),
        `función ${funcionId}`,
      ).toEqual([]);
    }

    // La 3 y la 4 son del mismo evento que la 5 (el 4).
    expect(service.findFuncion(3).eventoId).toBe(4);
    expect(service.findFuncion(4).eventoId).toBe(4);
    expect(service.findFuncion(5).eventoId).toBe(4);
  });

  it('cada función de ejemplo pertenece a un evento que existe', () => {
    for (let id = 1; id <= 10; id += 1) {
      expect(() => service.findFuncion(id), `función ${id}`).not.toThrow();

      const funcion = service.findFuncion(id);
      const evento = eventos.findOne(funcion.eventoId);
      expect(funcion, `función ${id}`).toEqual({
        ...funciones.findOne(id),
        titulo: evento.titulo,
        ciudad: evento.ciudad,
        lugar: evento.lugar,
      });
    }
  });

  it('modificar el resultado de findAsientos o de findFuncion no altera los datos internos', () => {
    const asientos = service.findAsientos(5);
    asientos[0].estado = 'ocupado'; // A1 estaba disponible
    asientos[2].estado = 'disponible'; // A3 estaba ocupado
    asientos[1].id = 'Z9';
    asientos.pop();
    asientos.length = 0;

    expect(service.findAsientos(5)).toEqual(ASIENTOS_DE_LA_5);
    expect(service.findAsientos(10)).toEqual(ASIENTOS_LIBRES);
    // Cada llamada arma objetos nuevos.
    expect(service.findAsientos(5)[0]).not.toBe(service.findAsientos(5)[0]);
    expect(service.findAsientos(5)).not.toBe(service.findAsientos(5));

    const funcion = service.findFuncion(5);
    funcion.titulo = 'Modificado';
    funcion.ciudad = 'Modificada';
    funcion.lugar = 'Modificado';
    funcion.inicio = '2000-01-01T00:00:00-05:00';
    funcion.precio = 1;
    funcion.eventoId = 99;

    expect(service.findFuncion(5)).toEqual({
      id: 5,
      eventoId: 4,
      titulo: 'Cartas a Medianoche',
      ciudad: 'Neiva',
      lugar: 'Teatro Municipal de Neiva',
      inicio: '2026-11-21T16:00:00-05:00',
      precio: 25000,
    });
    expect(service.findFuncion(5)).not.toBe(service.findFuncion(5));
    // Ni la función ni el evento de los servicios reales cambiaron.
    expect(funciones.findOne(5)).toEqual({
      id: 5,
      eventoId: 4,
      inicio: '2026-11-21T16:00:00-05:00',
      precio: 25000,
    });
    expect(eventos.findOne(4).titulo).toBe('Cartas a Medianoche');
  });

  // CA-2 · ocupar se ve en findAsientos, solo en esa función.
  it('ocupar marca los asientos en esa función y findAsientos los muestra ocupados; las demás funciones no cambian', () => {
    expect(service.findAsientos(1)).toEqual(ASIENTOS_LIBRES);

    service.ocupar(1, ['A1', 'A2']);

    const asientos = service.findAsientos(1);
    expect(ocupadosDe(asientos)).toEqual(['A1', 'A2']);
    expect(asientos).toEqual(asientosEsperados(['A1', 'A2']));
    expect(asientos[0]).toEqual({
      id: 'A1',
      fila: 'A',
      numero: 1,
      estado: 'ocupado',
    });
    expect(asientos[1]).toEqual({
      id: 'A2',
      fila: 'A',
      numero: 2,
      estado: 'ocupado',
    });

    // La 5 conserva sus seis ocupados, sin A1 ni A2.
    expect(ocupadosDe(service.findAsientos(5))).toEqual(OCUPADOS_DE_LA_5);
    expect(service.findAsientos(5)).toEqual(ASIENTOS_DE_LA_5);

    // La 2 es del mismo evento que la 1 y sigue con sus 40 disponibles.
    expect(service.findAsientos(2)).toEqual(ASIENTOS_LIBRES);
    for (const funcionId of [2, 3, 4, 6, 7, 8, 9, 10]) {
      expect(service.findAsientos(funcionId), `función ${funcionId}`).toEqual(
        ASIENTOS_LIBRES,
      );
    }
  });

  it('ocupar es síncrono: no devuelve nada y los asientos ya están ocupados cuando vuelve', () => {
    const devuelto: unknown = service.ocupar(1, ['A1']);

    expect(devuelto).toBeUndefined();
    expect(ocupadosDe(service.findAsientos(1))).toEqual(['A1']);
  });

  it('ocupar en una función que ya tenía ocupados conserva los anteriores y suma los nuevos, listados en el orden del plano', () => {
    service.ocupar(5, ['B2', 'A1']);

    expect(ocupadosDe(service.findAsientos(5))).toEqual([
      'A1',
      'A3',
      'A4',
      'B2',
      'C1',
      'C8',
      'D5',
      'E8',
    ]);
    expect(service.findAsientos(5)).toEqual(
      asientosEsperados([...OCUPADOS_DE_LA_5, 'A1', 'B2']),
    );
  });

  it('dos llamadas a ocupar en la misma función suman sus asientos y la segunda no borra la primera', () => {
    service.ocupar(10, ['A1']);
    service.ocupar(10, ['E8', 'B1']);

    expect(ocupadosDe(service.findAsientos(10))).toEqual(['A1', 'B1', 'E8']);
    expect(service.findAsientos(10)).toEqual(
      asientosEsperados(['A1', 'B1', 'E8']),
    );
  });

  it('ocupar acepta seis asientos de una vez y un asiento que está ocupado en otra función', () => {
    // A3 y C1 están ocupados en la función 5, no en la 10.
    service.ocupar(10, ['A3', 'C1', 'B5', 'B6', 'D1', 'E1']);

    expect(ocupadosDe(service.findAsientos(10))).toEqual([
      'A3',
      'B5',
      'B6',
      'C1',
      'D1',
      'E1',
    ]);
    expect(ocupadosDe(service.findAsientos(5))).toEqual(OCUPADOS_DE_LA_5);
  });

  // CA-3 · todo o nada.
  it('ocupar lanza 409 con los asientos no disponibles y no ocupa ninguno de los pedidos', () => {
    esperarConflicto(
      () => service.ocupar(5, ['A1', 'A3', 'C1']),
      'Estos asientos ya no están disponibles: A3, C1',
      ['A3', 'C1'],
    );

    // A1 estaba libre y sigue libre; los seis de siempre no cambiaron.
    const asientos = service.findAsientos(5);
    expect(ocupadosDe(asientos)).toEqual(OCUPADOS_DE_LA_5);
    expect(asientos).toEqual(ASIENTOS_DE_LA_5);
    expect(asientos[0]).toEqual({
      id: 'A1',
      fila: 'A',
      numero: 1,
      estado: 'disponible',
    });
  });

  it('ocupar lanza 409 con todos los pedidos si todos están ocupados, en el orden en que se pidieron', () => {
    esperarConflicto(
      () => service.ocupar(5, ['E8', 'A3']),
      'Estos asientos ya no están disponibles: E8, A3',
      ['E8', 'A3'],
    );
    esperarConflicto(
      () => service.ocupar(5, ['D5']),
      'Estos asientos ya no están disponibles: D5',
      ['D5'],
    );

    expect(service.findAsientos(5)).toEqual(ASIENTOS_DE_LA_5);
  });

  it('ocupar lanza 409 si un asiento lo ocupó una llamada anterior, nombra solo ese y no ocupa los libres que iban antes', () => {
    service.ocupar(1, ['A1', 'A2']);

    // A3 y B1 van antes y después del ocupado, y están libres.
    esperarConflicto(
      () => service.ocupar(1, ['A3', 'A2', 'B1', 'A1']),
      'Estos asientos ya no están disponibles: A2, A1',
      ['A2', 'A1'],
    );

    expect(ocupadosDe(service.findAsientos(1))).toEqual(['A1', 'A2']);
    expect(service.findAsientos(1)).toEqual(asientosEsperados(['A1', 'A2']));
  });

  it('un 409 repetido da la misma respuesta cada vez porque no deja asientos a medio ocupar', () => {
    for (let intento = 1; intento <= 2; intento += 1) {
      esperarConflicto(
        () => service.ocupar(5, ['A1', 'B1', 'A3']),
        'Estos asientos ya no están disponibles: A3',
        ['A3'],
      );
    }

    expect(service.findAsientos(5)).toEqual(ASIENTOS_DE_LA_5);
  });

  // CA-4 · el plano del lugar, escrito a mano.
  it('existeEnElPlano acepta los 40 asientos del plano y rechaza A0, A9, F1, a1, A01, A10, « A1» y el texto vacío', () => {
    const delPlano = [
      'A1',
      'A2',
      'A3',
      'A4',
      'A5',
      'A6',
      'A7',
      'A8',
      'B1',
      'B2',
      'B3',
      'B4',
      'B5',
      'B6',
      'B7',
      'B8',
      'C1',
      'C2',
      'C3',
      'C4',
      'C5',
      'C6',
      'C7',
      'C8',
      'D1',
      'D2',
      'D3',
      'D4',
      'D5',
      'D6',
      'D7',
      'D8',
      'E1',
      'E2',
      'E3',
      'E4',
      'E5',
      'E6',
      'E7',
      'E8',
    ];
    expect(delPlano).toHaveLength(40);
    for (const id of delPlano) {
      expect(service.existeEnElPlano(id), id).toBe(true);
    }

    for (const id of ['A0', 'A9', 'F1', 'a1', 'A01', 'A10', ' A1', '']) {
      expect(service.existeEnElPlano(id), `«${id}»`).toBe(false);
    }
  });

  it('existeEnElPlano rechaza los textos que rozan el plano: el límite de filas y de números, espacios, minúsculas y listas', () => {
    const noSonDelPlano = [
      'A1 ',
      ' A1 ',
      'A1\n',
      'E0',
      'E9',
      'F8',
      '@1',
      '01',
      'A',
      '1',
      'AA1',
      'A1A',
      'a',
      'e8',
      'A-1',
      'A 1',
      'A1,A2',
      'Z9',
    ];
    for (const id of noSonDelPlano) {
      expect(service.existeEnElPlano(id), JSON.stringify(id)).toBe(false);
    }
  });

  it('existeEnElPlano responde igual para un asiento ocupado que para uno libre', () => {
    service.ocupar(1, ['A1']);

    // A1 está ocupado en la 1, A3 lo está en la 5 y B1 no lo está en ninguna.
    expect(service.existeEnElPlano('A1')).toBe(true);
    expect(service.existeEnElPlano('A3')).toBe(true);
    expect(service.existeEnElPlano('B1')).toBe(true);
  });

  // CA-5 · ocupar empieza por buscar la función.
  it('ocupar lanza 404 si la función no existe', () => {
    for (const id of [9999, 0, -1]) {
      // Con asientos libres, con un id que no es del plano y con la lista vacía:
      // el 404 sale primero y no depende de los asientos.
      for (const ids of [['A1'], ['A3', 'Z9'], []]) {
        const error = lanzado(() => service.ocupar(id, ids));

        expect(
          error,
          `función ${id}, asientos ${ids.join(',')}`,
        ).toBeInstanceOf(NotFoundException);
        expect((error as NotFoundException).getResponse()).toEqual({
          statusCode: 404,
          message: `La función ${id} no existe`,
          error: 'Not Found',
        });
      }
    }

    expect(() => service.ocupar(9999, ['A1'])).toThrow(NotFoundException);
    expect(() => service.ocupar(9999, ['A1'])).toThrow(
      /^La función 9999 no existe$/,
    );
    expect(() => service.ocupar(0, ['A1'])).toThrow(/^La función 0 no existe$/);
    expect(() => service.ocupar(-1, ['A1'])).toThrow(
      /^La función -1 no existe$/,
    );
    // Ninguna función existente cambió.
    expect(service.findAsientos(1)).toEqual(ASIENTOS_LIBRES);
    expect(service.findAsientos(5)).toEqual(ASIENTOS_DE_LA_5);
  });

  // Sin criterio (B2 de la spec 004, D9): pasa desde el rojo porque fija un
  // comportamiento que ya existe. El servicio de eventos es el real; solo
  // cambia la función que le llega a findFuncion.
  it('findFuncion responde 404 «El evento 99 no existe» si su función apunta a un evento que no existe', () => {
    const funcionReal = funciones.findOne(5);
    const buscar = vi
      .spyOn(funciones, 'findOne')
      .mockReturnValue({ ...funcionReal, eventoId: 99 });

    const error = lanzado(() => service.findFuncion(5));

    expect(error).toBeInstanceOf(NotFoundException);
    expect((error as NotFoundException).getResponse()).toEqual({
      statusCode: 404,
      message: 'El evento 99 no existe',
      error: 'Not Found',
    });
    expect(buscar).toHaveBeenCalledWith(5);
  });

  // Las copias: ni el resultado de findAsientos ni la lista que se pasó a
  // ocupar dan acceso al estado interno.
  it('modificar el resultado de findAsientos o la lista que se pasó a ocupar no altera los ocupados', () => {
    const pedidos = ['A1', 'B2'];
    service.ocupar(1, pedidos);

    pedidos[0] = 'Z9';
    pedidos.push('E8');
    pedidos.length = 0;

    const asientos = service.findAsientos(1);
    asientos[0].estado = 'disponible'; // A1 estaba ocupado
    asientos[18].estado = 'ocupado'; // C3 estaba disponible
    asientos[9].id = 'Z9';
    asientos.length = 0;

    expect(service.findAsientos(1)).toEqual(asientosEsperados(['A1', 'B2']));
    expect(service.findAsientos(2)).toEqual(ASIENTOS_LIBRES);
    expect(service.findAsientos(5)).toEqual(ASIENTOS_DE_LA_5);
  });
});
