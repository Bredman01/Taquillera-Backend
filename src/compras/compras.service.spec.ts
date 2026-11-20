import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { AsientosService } from '../asientos/asientos.service.js';
import { EventosService } from '../eventos/eventos.service.js';
import { FuncionesService } from '../funciones/funciones.service.js';
import { ComprasService } from './compras.service.js';
import { GeneradorCodigo } from './generador-codigo.js';
import { Reloj } from './reloj.js';

// D10: la fecha de la compra va en hora de Colombia. En el hilo principal las
// pruebas corren en Asia/Tokyo, 14 h por delante de Colombia, para que un
// código que use la hora local del servidor dé otro día y otra hora. La zona se
// asigna en vi.hoisted, que corre antes de los import: el formateador Intl de
// hora-colombia.ts se crea al importar el módulo y fija su zona en ese momento.
// Stryker usa hilos y allí asignar TZ no cambia la zona: por eso solo se fuerza
// en el hilo principal. vi.hoisted no puede usar los import del archivo, así
// que isMainThread se importa dentro.
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

// Los únicos ocupados de los datos de ejemplo: los de la función 5.
const OCUPADOS_DE_LA_5 = ['A3', 'A4', 'C1', 'C8', 'D5', 'E8'];

// Los ocupados de cada una de las diez funciones, en el orden de las funciones.
const OCUPADOS_AL_INICIO = Array.from({ length: 10 }, (_, indice) =>
  indice + 1 === 5 ? OCUPADOS_DE_LA_5 : [],
);

const INSTANTE = Date.parse('2026-11-19T20:04:05Z');
const FECHA_DEL_INSTANTE = '2026-11-19T15:04:05-05:00';

const NOMBRE = 'Ana Pérez';
const CORREO = 'ana@correo.co';

const SIN_LISTA = 'La lista de asientos no es válida';
const SIN_ASIENTOS = 'Elige al menos un asiento';
const DEMASIADOS = 'Puedes comprar máximo 6 boletas por compra';
const SIN_NOMBRE = 'Escribe tu nombre completo';
const NOMBRE_LARGO = 'El nombre admite máximo 100 caracteres';
const CORREO_INVALIDO = 'Escribe un correo electrónico válido';

const repetido = (id: string) => `El asiento ${id} está repetido`;
const inexistente = (id: string) => `El asiento ${id} no existe en el lugar`;

// El único doble de código: la clase real con `generar` reemplazado.
class GeneradorDePrueba extends GeneradorCodigo {
  constructor(private readonly siguiente: () => string) {
    super();
  }

  override generar(): string {
    return this.siguiente();
  }
}

// El único doble de hora: la clase real con `ahora` fijo.
class RelojDePrueba extends Reloj {
  constructor(private readonly instante: number) {
    super();
  }

  override ahora(): number {
    return this.instante;
  }
}

// Devuelve los códigos en el orden dado. Si se piden más, falla: así una
// compra que pide un código de más no se confunde con una que acierta.
function enSecuencia(codigos: string[]): () => string {
  let siguiente = 0;
  return () => {
    if (siguiente >= codigos.length) {
      throw new Error('El generador de prueba se quedó sin códigos');
    }
    const codigo = codigos[siguiente];
    siguiente += 1;
    return codigo;
  };
}

// Servicios nuevos en cada prueba: los reales de funciones, eventos y asientos,
// y solo el generador y el reloj son dobles.
function armar(
  siguiente: () => string = () => 'ABCD1234',
  instante: number = INSTANTE,
) {
  const funciones = new FuncionesService();
  const eventos = new EventosService(funciones);
  const asientos = new AsientosService(funciones, eventos);
  const generar = vi.fn(siguiente);
  const service = new ComprasService(
    funciones,
    asientos,
    new GeneradorDePrueba(generar),
    new RelojDePrueba(instante),
  );
  return { asientos, generar, service };
}

// Los ids de los asientos ocupados, en el orden del plano.
const ocupadosDe = (asientos: ReadonlyArray<{ id: string; estado: string }>) =>
  asientos
    .filter((asiento) => asiento.estado === 'ocupado')
    .map((asiento) => asiento.id);

const ocupadosEnLasDiez = (asientos: AsientosService) =>
  Array.from({ length: 10 }, (_, indice) =>
    ocupadosDe(asientos.findAsientos(indice + 1)),
  );

// Las compras guardadas. D10: la lectura por código es de la spec 006, así que
// las pruebas leen el Map privado.
const guardadas = (service: ComprasService) => [...service['compras'].values()];

// Un cuerpo válido, con los cambios que se pidan encima.
function cuerpo(
  cambios: Record<string, unknown> = {},
): Record<string, unknown> {
  return { asientos: ['A1', 'A2'], nombre: NOMBRE, correo: CORREO, ...cambios };
}

// Ejecuta la acción y devuelve lo que lanzó. Si no lanza nada, la prueba falla:
// así un `crear` que no lanza, o que lanza más tarde (async), no pasa.
function lanzado(accion: () => unknown, contexto = ''): unknown {
  try {
    accion();
  } catch (error) {
    return error;
  }
  throw new Error(
    `Se esperaba una excepción y no se lanzó ninguna ${contexto}`.trim(),
  );
}

function esperarMalaPeticion(
  accion: () => unknown,
  mensaje: string,
  contexto: string,
) {
  const error = lanzado(accion, contexto);
  expect(error, contexto).toBeInstanceOf(BadRequestException);
  const mala = error as BadRequestException;
  expect(mala.getStatus(), contexto).toBe(400);
  expect(mala.getResponse(), contexto).toEqual({
    statusCode: 400,
    message: mensaje,
    error: 'Bad Request',
  });
}

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

const SIETE_ASIENTOS = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7'];

// [qué se prueba, lo que recibe crear, el mensaje de la primera regla que falla]
const CASOS_DE_400: Array<[string, unknown, string]> = [
  // Regla 1: `asientos` es un arreglo de textos. Un cuerpo que no es un objeto
  // se trata como `{}`.
  ['sin cuerpo (undefined)', undefined, SIN_LISTA],
  ['cuerpo null', null, SIN_LISTA],
  ['cuerpo que es un texto', 'A1', SIN_LISTA],
  ['cuerpo que es un número', 42, SIN_LISTA],
  ['cuerpo que es un booleano', true, SIN_LISTA],
  ['cuerpo que es un arreglo', ['A1'], SIN_LISTA],
  ['cuerpo vacío', {}, SIN_LISTA],
  ['asientos ausente', cuerpo({ asientos: undefined }), SIN_LISTA],
  ['asientos null', cuerpo({ asientos: null }), SIN_LISTA],
  ['asientos que es un texto', cuerpo({ asientos: 'A1' }), SIN_LISTA],
  ['asientos que es un número', cuerpo({ asientos: 1 }), SIN_LISTA],
  ['asientos que es un objeto', cuerpo({ asientos: { 0: 'A1' } }), SIN_LISTA],
  ['asientos con números', cuerpo({ asientos: [1, 2] }), SIN_LISTA],
  ['asientos con un número', cuerpo({ asientos: ['A1', 2] }), SIN_LISTA],
  ['asientos con un null', cuerpo({ asientos: ['A1', null] }), SIN_LISTA],
  ['asientos con una lista dentro', cuerpo({ asientos: [['A1']] }), SIN_LISTA],

  // Regla 2: al menos uno.
  ['lista de asientos vacía', cuerpo({ asientos: [] }), SIN_ASIENTOS],

  // Regla 3: máximo 6.
  ['siete asientos', cuerpo({ asientos: SIETE_ASIENTOS }), DEMASIADOS],
  [
    'ocho asientos',
    cuerpo({ asientos: [...SIETE_ASIENTOS, 'A8'] }),
    DEMASIADOS,
  ],
  [
    'siete asientos de filas distintas',
    cuerpo({ asientos: ['A1', 'B1', 'C1', 'D1', 'E1', 'A2', 'B2'] }),
    DEMASIADOS,
  ],

  // Regla 4: sin repetidos, comparación exacta.
  [
    'asiento repetido al final',
    cuerpo({ asientos: ['A1', 'A2', 'A1'] }),
    repetido('A1'),
  ],
  [
    'dos asientos iguales seguidos',
    cuerpo({ asientos: ['B3', 'B3'] }),
    repetido('B3'),
  ],
  [
    'asiento repetido entre otros',
    cuerpo({ asientos: ['E8', 'A1', 'E8'] }),
    repetido('E8'),
  ],
  [
    'asiento escrito tres veces',
    cuerpo({ asientos: ['A2', 'A1', 'A1', 'A1'] }),
    repetido('A1'),
  ],
  [
    'repetido en el sexto lugar',
    cuerpo({ asientos: ['A1', 'A2', 'A3', 'A4', 'A5', 'A5'] }),
    repetido('A5'),
  ],
  [
    'dos repetidos distintos: se nombra el primero en repetirse, no el primero de la lista',
    cuerpo({ asientos: ['A1', 'B2', 'B2', 'A1'] }),
    repetido('B2'),
  ],
  [
    'dos repetidos distintos, al revés: se nombra el primero en repetirse',
    cuerpo({ asientos: ['B2', 'A1', 'A1', 'B2'] }),
    repetido('A1'),
  ],

  // Regla 5: cada uno existe en el plano, en mayúsculas y sin espacios.
  ['asiento que no existe', cuerpo({ asientos: ['Z9'] }), inexistente('Z9')],
  [
    'asiento que no existe después de uno válido',
    cuerpo({ asientos: ['A1', 'Z9'] }),
    inexistente('Z9'),
  ],
  [
    'el primero que no existe, no el último',
    cuerpo({ asientos: ['A1', 'F1', 'Z9'] }),
    inexistente('F1'),
  ],
  [
    'dos que no existen distintos',
    cuerpo({ asientos: ['Z9', 'Y8'] }),
    inexistente('Z9'),
  ],
  ['minúscula', cuerpo({ asientos: ['a1'] }), inexistente('a1')],
  ['número 9', cuerpo({ asientos: ['A9'] }), inexistente('A9')],
  ['número 10', cuerpo({ asientos: ['A10'] }), inexistente('A10')],
  ['número 0', cuerpo({ asientos: ['A0'] }), inexistente('A0')],
  ['fila F', cuerpo({ asientos: ['F1'] }), inexistente('F1')],
  ['E9', cuerpo({ asientos: ['E9'] }), inexistente('E9')],
  ['cero a la izquierda', cuerpo({ asientos: ['A01'] }), inexistente('A01')],
  ['espacio antes', cuerpo({ asientos: [' A1'] }), inexistente(' A1')],
  ['espacio después', cuerpo({ asientos: ['A1 '] }), inexistente('A1 ')],
  ['texto vacío', cuerpo({ asientos: [''] }), inexistente('')],
  [
    'A1 y a1 no son el mismo asiento: no es un repetido, es uno que no existe',
    cuerpo({ asientos: ['A1', 'a1'] }),
    inexistente('a1'),
  ],

  // Regla 6: `nombre` es texto y, recortado, no está vacío.
  ['nombre ausente', cuerpo({ nombre: undefined }), SIN_NOMBRE],
  ['nombre vacío', cuerpo({ nombre: '' }), SIN_NOMBRE],
  ['nombre de solo espacios', cuerpo({ nombre: '   ' }), SIN_NOMBRE],
  [
    'nombre de espacios, tabulaciones y saltos de línea',
    cuerpo({ nombre: ' \t\n ' }),
    SIN_NOMBRE,
  ],
  ['nombre null', cuerpo({ nombre: null }), SIN_NOMBRE],
  ['nombre que es un número', cuerpo({ nombre: 42 }), SIN_NOMBRE],
  ['nombre que es una lista', cuerpo({ nombre: ['Ana'] }), SIN_NOMBRE],
  ['nombre que es un objeto', cuerpo({ nombre: {} }), SIN_NOMBRE],

  // Regla 7: `nombre`, recortado, de máximo 100 caracteres.
  [
    'nombre de 101 caracteres',
    cuerpo({ nombre: 'N'.repeat(101) }),
    NOMBRE_LARGO,
  ],
  [
    'nombre de 101 caracteres con espacios alrededor',
    cuerpo({ nombre: ` ${'N'.repeat(101)} ` }),
    NOMBRE_LARGO,
  ],
  [
    'nombre de 200 caracteres',
    cuerpo({ nombre: 'N'.repeat(200) }),
    NOMBRE_LARGO,
  ],

  // Regla 8: `correo` es texto y, recortado, tiene formato de correo y máximo
  // 254 caracteres.
  ['correo ausente', cuerpo({ correo: undefined }), CORREO_INVALIDO],
  ['correo null', cuerpo({ correo: null }), CORREO_INVALIDO],
  ['correo que es un número', cuerpo({ correo: 42 }), CORREO_INVALIDO],
  ['correo que es una lista', cuerpo({ correo: [CORREO] }), CORREO_INVALIDO],
  ['correo vacío', cuerpo({ correo: '' }), CORREO_INVALIDO],
  ['correo de solo espacios', cuerpo({ correo: '   ' }), CORREO_INVALIDO],
  ['correo sin arroba', cuerpo({ correo: 'ana.correo.co' }), CORREO_INVALIDO],
  [
    'correo sin punto en el dominio',
    cuerpo({ correo: 'ana@correo' }),
    CORREO_INVALIDO,
  ],
  [
    'correo con un espacio en el medio',
    cuerpo({ correo: 'ana correo@x.co' }),
    CORREO_INVALIDO,
  ],
  [
    'correo con un espacio en el dominio',
    cuerpo({ correo: 'ana@co rreo.co' }),
    CORREO_INVALIDO,
  ],
  ['correo sin la parte local', cuerpo({ correo: '@x.co' }), CORREO_INVALIDO],
  [
    'correo con el dominio vacío antes del punto',
    cuerpo({ correo: 'ana@.co' }),
    CORREO_INVALIDO,
  ],
  [
    'correo que termina en punto',
    cuerpo({ correo: 'ana@correo.' }),
    CORREO_INVALIDO,
  ],
  [
    'correo con dos arrobas seguidas',
    cuerpo({ correo: 'ana@@correo.co' }),
    CORREO_INVALIDO,
  ],
  [
    'correo con dos arrobas separadas',
    cuerpo({ correo: 'ana@x@correo.co' }),
    CORREO_INVALIDO,
  ],
  [
    'correo de 255 caracteres',
    cuerpo({ correo: `${'a'.repeat(250)}@x.co` }),
    CORREO_INVALIDO,
  ],
  [
    'correo de 255 caracteres con espacios alrededor',
    cuerpo({ correo: ` ${'a'.repeat(250)}@x.co ` }),
    CORREO_INVALIDO,
  ],
];

// Cuando fallan varias reglas a la vez, responde la primera de la lista.
const CASOS_DE_ORDEN: Array<[string, unknown, string]> = [
  [
    'siete asientos repetidos e inexistentes: gana el máximo',
    cuerpo({ asientos: Array.from({ length: 7 }, () => 'Z9') }),
    DEMASIADOS,
  ],
  [
    'siete asientos, nombre y correo malos: gana el máximo',
    cuerpo({ asientos: SIETE_ASIENTOS, nombre: '', correo: 'x' }),
    DEMASIADOS,
  ],
  [
    'asiento repetido e inexistente a la vez: gana el repetido',
    cuerpo({ asientos: ['Z9', 'Z9'] }),
    repetido('Z9'),
  ],
  [
    'inexistente antes de un repetido en la lista: gana el repetido',
    cuerpo({ asientos: ['Z9', 'A1', 'A1'] }),
    repetido('A1'),
  ],
  [
    'asiento inexistente y nombre vacío: gana el asiento',
    cuerpo({ asientos: ['Z9'], nombre: '' }),
    inexistente('Z9'),
  ],
  [
    'lista de asientos mal formada, nombre y correo malos: gana la lista',
    { asientos: 'A1', nombre: '', correo: '' },
    SIN_LISTA,
  ],
  [
    'lista vacía, nombre y correo malos: gana la lista vacía',
    { asientos: [], nombre: '', correo: 'x' },
    SIN_ASIENTOS,
  ],
  [
    'nombre vacío y correo inválido: gana el nombre',
    cuerpo({ nombre: '', correo: 'x' }),
    SIN_NOMBRE,
  ],
  [
    'nombre de 101 caracteres y correo inválido: gana el nombre',
    cuerpo({ nombre: 'N'.repeat(101), correo: 'x' }),
    NOMBRE_LARGO,
  ],
];

describe('ComprasService', () => {
  // CA-1 · los cinco campos exactos, con el total y la fecha en hora de Colombia.
  it('crear devuelve el código, la función, los asientos, el total (precio por cantidad) y la fecha en hora de Colombia, y nada más', () => {
    const { service } = armar();

    const compra = service.crear(1, {
      asientos: ['A1', 'A2'],
      nombre: '  Ana Pérez ',
      correo: ' ana@correo.co ',
    });

    expect(compra).toEqual({
      codigo: 'ABCD1234',
      funcionId: 1,
      asientos: ['A1', 'A2'],
      total: 30000,
      fecha: FECHA_DEL_INSTANTE,
    });
    expect(Object.keys(compra).sort()).toEqual([
      'asientos',
      'codigo',
      'fecha',
      'funcionId',
      'total',
    ]);

    // La función 10 cuesta 8.000: seis asientos son 48.000.
    const diez = armar(() => 'ZZZZ0010').service.crear(
      10,
      cuerpo({ asientos: ['A1', 'A2', 'A3', 'B1', 'B2', 'B3'] }),
    );
    expect(diez).toEqual({
      codigo: 'ZZZZ0010',
      funcionId: 10,
      asientos: ['A1', 'A2', 'A3', 'B1', 'B2', 'B3'],
      total: 48000,
      fecha: FECHA_DEL_INSTANTE,
    });

    // La función 5 cuesta 25.000 y la 9, 35.000: el total sale del precio de
    // la función, no de uno fijo.
    expect(
      armar().service.crear(5, cuerpo({ asientos: ['A1', 'B2', 'E1'] })).total,
    ).toBe(75000);
    const nueve = armar().service.crear(9, cuerpo({ asientos: ['C4'] }));
    expect(nueve.total).toBe(35000);
    expect(nueve.funcionId).toBe(9);

    // La fecha sale de la hora que da el reloj, en hora de Colombia: un
    // milisegundo antes de las 00:00 del 22 de noviembre, sin redondear.
    const casiMedianoche = armar(
      () => 'ABCD1234',
      Date.parse('2026-11-22T04:59:59.999Z'),
    ).service.crear(1, cuerpo());
    expect(casiMedianoche.fecha).toBe('2026-11-21T23:59:59-05:00');
  });

  it('crear guarda la compra con el nombre y el correo recortados', () => {
    const { service } = armar();

    service.crear(1, {
      asientos: ['A1', 'A2'],
      nombre: '  Ana Pérez ',
      correo: ' ana@correo.co ',
    });

    const esperada = {
      codigo: 'ABCD1234',
      funcionId: 1,
      asientos: ['A1', 'A2'],
      total: 30000,
      fecha: FECHA_DEL_INSTANTE,
      nombre: 'Ana Pérez',
      correo: 'ana@correo.co',
    };
    // El código es la clave del Map.
    expect([...service['compras'].keys()]).toEqual(['ABCD1234']);
    expect(service['compras'].get('ABCD1234')).toEqual(esperada);
    expect(guardadas(service)).toEqual([esperada]);
    expect(Object.keys(guardadas(service)[0]).sort()).toEqual([
      'asientos',
      'codigo',
      'correo',
      'fecha',
      'funcionId',
      'nombre',
      'total',
    ]);

    // Se recorta todo el espacio en blanco, no solo los espacios.
    const otra = armar(() => 'WXYZ5678').service;
    otra.crear(
      2,
      cuerpo({ nombre: '\n Luis Gómez\t', correo: '\tluis@correo.co\n' }),
    );
    expect(guardadas(otra)).toEqual([
      {
        codigo: 'WXYZ5678',
        funcionId: 2,
        asientos: ['A1', 'A2'],
        total: 30000,
        fecha: FECHA_DEL_INSTANTE,
        nombre: 'Luis Gómez',
        correo: 'luis@correo.co',
      },
    ]);
  });

  // Sin criterio (D8): se piden en un orden y se responden en ese orden.
  it('crear responde y guarda los asientos en el orden en que se pidieron, no en el del plano', () => {
    const { service } = armar();

    const compra = service.crear(1, cuerpo({ asientos: ['E8', 'A1', 'B2'] }));

    expect(compra.asientos).toEqual(['E8', 'A1', 'B2']);
    expect(guardadas(service)[0].asientos).toEqual(['E8', 'A1', 'B2']);
  });

  // Sin criterio (D8): el total sale del precio de la función, no del cuerpo.
  it('crear calcula el total con el precio de la función aunque el cuerpo traiga uno', () => {
    const { service } = armar();

    const compra = service.crear(
      1,
      cuerpo({ total: 1, precio: 1, codigo: 'X' }),
    );

    expect(compra.total).toBe(30000);
    expect(compra.codigo).toBe('ABCD1234');
    expect(guardadas(service)[0].total).toBe(30000);
  });

  // CA-2 y CA-3 · la compra ocupa por el servicio de asientos, no por una lista
  // propia: lo que muestra después el mapa es lo que ocupó la compra.
  it('crear ocupa los asientos por el servicio de asientos: findAsientos los muestra ocupados y las demás funciones no cambian', () => {
    const { asientos, service } = armar();
    expect(ocupadosEnLasDiez(asientos)).toEqual(OCUPADOS_AL_INICIO);

    service.crear(1, cuerpo({ asientos: ['A1', 'A2'] }));

    expect(ocupadosDe(asientos.findAsientos(1))).toEqual(['A1', 'A2']);
    expect(asientos.findAsientos(1)[0]).toEqual({
      id: 'A1',
      fila: 'A',
      numero: 1,
      estado: 'ocupado',
    });
    // Ninguna otra función cambió: ni la 2, del mismo evento, ni la 5.
    expect(ocupadosEnLasDiez(asientos)).toEqual(
      OCUPADOS_AL_INICIO.map((ocupados, indice) =>
        indice === 0 ? ['A1', 'A2'] : ocupados,
      ),
    );

    // En la función 5 se suman a los seis de siempre.
    const otra = armar();
    otra.service.crear(5, cuerpo({ asientos: ['B2', 'A1'] }));
    expect(ocupadosDe(otra.asientos.findAsientos(5))).toEqual([
      'A1',
      'A3',
      'A4',
      'B2',
      'C1',
      'C8',
      'D5',
      'E8',
    ]);
  });

  // Sin criterio: la razón de ser de la spec, que no se venda dos veces un asiento.
  it('crear dos veces el mismo asiento lanza 409 la segunda vez y no cambia la primera compra', () => {
    const { asientos, service } = armar(enSecuencia(['AAAA1111', 'BBBB2222']));
    service.crear(1, cuerpo({ asientos: ['A1', 'A2'] }));

    esperarConflicto(
      () => service.crear(1, cuerpo({ asientos: ['A3', 'A2'] })),
      'Estos asientos ya no están disponibles: A2',
      ['A2'],
    );

    expect(ocupadosDe(asientos.findAsientos(1))).toEqual(['A1', 'A2']);
    expect(guardadas(service)).toHaveLength(1);
    expect(guardadas(service)[0].asientos).toEqual(['A1', 'A2']);
  });

  // CA-3 · todo o nada, y la compra no se guarda.
  it('crear con un asiento ocupado lanza 409, no ocupa ninguno y no guarda la compra', () => {
    const { asientos, service } = armar();

    esperarConflicto(
      () =>
        service.crear(
          5,
          cuerpo({ asientos: ['A1', 'A3', 'C1'], nombre: NOMBRE }),
        ),
      'Estos asientos ya no están disponibles: A3, C1',
      ['A3', 'C1'],
    );

    // A1 estaba libre y sigue libre; los seis de siempre no cambiaron.
    expect(ocupadosDe(asientos.findAsientos(5))).toEqual(OCUPADOS_DE_LA_5);
    expect(asientos.findAsientos(5)[0]).toEqual({
      id: 'A1',
      fila: 'A',
      numero: 1,
      estado: 'disponible',
    });
    expect(ocupadosEnLasDiez(asientos)).toEqual(OCUPADOS_AL_INICIO);
    expect(service['compras'].size).toBe(0);

    // La compra que falló no dejó nada a medias: A1 se puede comprar y el
    // código que se había pedido no quedó guardado.
    const compra = service.crear(5, cuerpo({ asientos: ['A1', 'B1'] }));
    expect(compra.codigo).toBe('ABCD1234');
    expect(ocupadosDe(asientos.findAsientos(5))).toEqual([
      'A1',
      'A3',
      'A4',
      'B1',
      'C1',
      'C8',
      'D5',
      'E8',
    ]);
  });

  // CA-4 · cada regla, su mensaje y que no ocupa nada.
  it('crear responde 400 con el mensaje de cada regla, en orden, y no ocupa asientos', () => {
    for (const [descripcion, entrada, mensaje] of CASOS_DE_400) {
      const { asientos, generar, service } = armar();

      esperarMalaPeticion(
        () => service.crear(1, entrada),
        mensaje,
        descripcion,
      );

      expect(ocupadosEnLasDiez(asientos), descripcion).toEqual(
        OCUPADOS_AL_INICIO,
      );
      expect(service['compras'].size, descripcion).toBe(0);
      // El 400 sale antes de pedir el código.
      expect(generar, descripcion).not.toHaveBeenCalled();
    }
  });

  it('crear responde con la primera regla que falla cuando fallan varias', () => {
    for (const [descripcion, entrada, mensaje] of CASOS_DE_ORDEN) {
      const { asientos, service } = armar();

      esperarMalaPeticion(
        () => service.crear(1, entrada),
        mensaje,
        descripcion,
      );

      expect(ocupadosEnLasDiez(asientos), descripcion).toEqual(
        OCUPADOS_AL_INICIO,
      );
      expect(service['compras'].size, descripcion).toBe(0);
    }
  });

  it('crear acepta seis asientos, un nombre de 100 caracteres y un correo de 254 caracteres, con o sin espacios alrededor', () => {
    // Seis asientos.
    const seis = armar();
    const compraDeSeis = seis.service.crear(
      1,
      cuerpo({ asientos: ['A1', 'A2', 'A3', 'B1', 'B2', 'B3'] }),
    );
    expect(compraDeSeis.asientos).toEqual(['A1', 'A2', 'A3', 'B1', 'B2', 'B3']);
    expect(compraDeSeis.total).toBe(90000);
    expect(ocupadosDe(seis.asientos.findAsientos(1))).toEqual([
      'A1',
      'A2',
      'A3',
      'B1',
      'B2',
      'B3',
    ]);

    // Un nombre de 100 caracteres, que se guarda recortado.
    const conNombre = armar();
    conNombre.service.crear(1, cuerpo({ nombre: ` ${'N'.repeat(100)} ` }));
    expect(guardadas(conNombre.service)[0].nombre).toBe('N'.repeat(100));
    expect(guardadas(conNombre.service)[0].nombre).toHaveLength(100);

    // Un correo de 254 caracteres, que se guarda recortado.
    const correo = `${'a'.repeat(249)}@x.co`;
    expect(correo).toHaveLength(254);
    const conCorreo = armar();
    conCorreo.service.crear(1, cuerpo({ correo: ` ${correo} ` }));
    expect(guardadas(conCorreo.service)[0].correo).toBe(correo);

    // Correos de formato válido que no son el de siempre.
    for (const valido of [
      'a@b.c',
      'ana.perez+cine@correo.com.co',
      'ana@sub.correo.co',
      'ñandú@correo.co',
    ]) {
      const { service } = armar();
      service.crear(1, cuerpo({ correo: valido }));
      expect(guardadas(service)[0].correo, valido).toBe(valido);
    }
  });

  // CA-5 · el 404 sale antes de mirar el cuerpo.
  it('crear responde 404 «La función 9999 no existe», también con 0 y -1, antes de validar el cuerpo', () => {
    const cuerpos: Array<[string, unknown]> = [
      ['cuerpo válido', cuerpo()],
      ['sin cuerpo', undefined],
      ['cuerpo vacío', {}],
      ['lista de asientos vacía', cuerpo({ asientos: [] })],
      ['asiento que no existe', cuerpo({ asientos: ['Z9'] })],
      ['nombre vacío', cuerpo({ nombre: '' })],
      ['correo inválido', cuerpo({ correo: 'ana' })],
    ];

    for (const id of [9999, 0, -1]) {
      for (const [descripcion, entrada] of cuerpos) {
        const { asientos, generar, service } = armar();
        const contexto = `función ${id}, ${descripcion}`;

        const error = lanzado(() => service.crear(id, entrada), contexto);

        expect(error, contexto).toBeInstanceOf(NotFoundException);
        expect((error as NotFoundException).getStatus(), contexto).toBe(404);
        expect((error as NotFoundException).getResponse(), contexto).toEqual({
          statusCode: 404,
          message: `La función ${id} no existe`,
          error: 'Not Found',
        });
        expect(ocupadosEnLasDiez(asientos), contexto).toEqual(
          OCUPADOS_AL_INICIO,
        );
        expect(service['compras'].size, contexto).toBe(0);
        expect(generar, contexto).not.toHaveBeenCalled();
      }
    }
  });

  // Sin criterio (D6): el código no se repite.
  it('crear pide otro código si el generador repite uno ya usado', () => {
    const { generar, service } = armar(
      enSecuencia(['AAAA1111', 'AAAA1111', 'BBBB2222']),
    );

    const primera = service.crear(1, cuerpo({ asientos: ['A1'] }));
    const segunda = service.crear(1, cuerpo({ asientos: ['A2'] }));

    expect(primera.codigo).toBe('AAAA1111');
    expect(segunda.codigo).toBe('BBBB2222');
    expect(generar).toHaveBeenCalledTimes(3);
    // Cada compra quedó guardada con su código: la segunda no pisó la primera.
    expect([...service['compras'].keys()]).toEqual(['AAAA1111', 'BBBB2222']);
    expect(service['compras'].get('AAAA1111')?.asientos).toEqual(['A1']);
    expect(service['compras'].get('BBBB2222')?.asientos).toEqual(['A2']);
  });

  it('crear acepta el código del décimo intento', () => {
    // La primera compra usa AAAA1111; la segunda recibe nueve veces ese
    // mismo código y el décimo intento acierta.
    const { generar, service } = armar(
      enSecuencia([
        'AAAA1111',
        ...Array.from({ length: 9 }, () => 'AAAA1111'),
        'BBBB2222',
      ]),
    );
    service.crear(1, cuerpo({ asientos: ['A1'] }));

    const segunda = service.crear(1, cuerpo({ asientos: ['A2'] }));

    expect(segunda.codigo).toBe('BBBB2222');
    expect(generar).toHaveBeenCalledTimes(11);
    expect(guardadas(service)).toHaveLength(2);
  });

  it('crear responde 500 y no ocupa asientos si no consigue un código libre en 10 intentos', () => {
    const { asientos, generar, service } = armar(() => 'AAAA1111');
    service.crear(1, cuerpo({ asientos: ['A1'] }));
    expect(generar).toHaveBeenCalledTimes(1);

    const error = lanzado(() =>
      service.crear(1, cuerpo({ asientos: ['B1', 'B2'] })),
    );

    expect(error).toBeInstanceOf(InternalServerErrorException);
    expect((error as InternalServerErrorException).getStatus()).toBe(500);
    expect((error as InternalServerErrorException).getResponse()).toEqual({
      statusCode: 500,
      message: 'No se pudo generar un código de compra único',
      error: 'Internal Server Error',
    });
    // Uno de la primera compra y diez intentos de la segunda.
    expect(generar).toHaveBeenCalledTimes(11);
    // Sus asientos siguen libres y solo existe la primera compra.
    expect(ocupadosDe(asientos.findAsientos(1))).toEqual(['A1']);
    expect(guardadas(service)).toHaveLength(1);
    expect(guardadas(service)[0].asientos).toEqual(['A1']);
  });

  it('crear responde 500 antes que 409 si el código está agotado y un asiento ya está ocupado', () => {
    const { asientos, generar, service } = armar(() => 'AAAA1111');
    service.crear(1, cuerpo({ asientos: ['A1'] }));

    // A3 está ocupado en la función 5, y el código ya está usado.
    const error = lanzado(() =>
      service.crear(5, cuerpo({ asientos: ['A3', 'B1'] })),
    );

    expect(error).toBeInstanceOf(InternalServerErrorException);
    expect(generar).toHaveBeenCalledTimes(11);
    expect(ocupadosDe(asientos.findAsientos(5))).toEqual(OCUPADOS_DE_LA_5);
    expect(guardadas(service)).toHaveLength(1);
  });

  it('crear pide el código antes de ocupar: con un asiento ocupado lanza 409 después de pedirlo', () => {
    const { generar, service } = armar();

    const error = lanzado(() => service.crear(5, cuerpo({ asientos: ['A3'] })));

    expect(error).toBeInstanceOf(ConflictException);
    expect(generar).toHaveBeenCalledTimes(1);
  });

  // Sin criterio (D8): ni lo devuelto ni la lista que se pasó dan acceso a lo guardado.
  it('modificar el resultado de crear o la lista que recibe no altera la compra guardada ni los ocupados', () => {
    const { asientos, service } = armar();
    const pedidos = ['A1', 'A2'];
    const entrada = {
      asientos: pedidos,
      nombre: ' Ana Pérez ',
      correo: CORREO,
    };

    const resultado = service.crear(1, entrada);

    // Se cambia la lista que se pasó y el cuerpo.
    pedidos[0] = 'Z9';
    pedidos.push('E8');
    pedidos.length = 0;
    entrada.nombre = 'Otro';
    entrada.correo = 'otro@correo.co';

    // Se cambia lo que devolvió crear.
    resultado.asientos[0] = 'Z9';
    resultado.asientos.push('E8');
    resultado.asientos.length = 0;
    resultado.codigo = 'XXXXXXXX';
    resultado.funcionId = 9;
    resultado.total = 1;
    resultado.fecha = 'ayer';

    expect(guardadas(service)).toEqual([
      {
        codigo: 'ABCD1234',
        funcionId: 1,
        asientos: ['A1', 'A2'],
        total: 30000,
        fecha: FECHA_DEL_INSTANTE,
        nombre: 'Ana Pérez',
        correo: CORREO,
      },
    ]);
    expect([...service['compras'].keys()]).toEqual(['ABCD1234']);
    expect(ocupadosEnLasDiez(asientos)).toEqual(
      OCUPADOS_AL_INICIO.map((ocupados, indice) =>
        indice === 0 ? ['A1', 'A2'] : ocupados,
      ),
    );
    // Lo guardado no es el mismo arreglo que se devolvió.
    expect(guardadas(service)[0].asientos).not.toBe(resultado.asientos);
  });
});
