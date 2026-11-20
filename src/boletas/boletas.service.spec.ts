import { ConflictException, NotFoundException } from '@nestjs/common';
import { AsientosService } from '../asientos/asientos.service.js';
import { ComprasService } from '../compras/compras.service.js';
import { GeneradorCodigo } from '../compras/generador-codigo.js';
import { Reloj } from '../compras/reloj.js';
import { EventosService } from '../eventos/eventos.service.js';
import { FuncionesService } from '../funciones/funciones.service.js';
import { BoletasService } from './boletas.service.js';

// D7: la fecha de uso va en hora de Colombia. En el hilo principal las pruebas
// corren en Asia/Tokyo, 14 h por delante de Colombia, para que un código que
// use la hora local del servidor dé otro día y otra hora. La zona se asigna en
// vi.hoisted, que corre antes de los import: el formateador Intl de
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

// La compra se hace en un instante y la boleta se usa días después: así una
// fecha de uso que saliera de la fecha de la compra no se confunde con la buena.
const INSTANTE_DE_LA_COMPRA = Date.parse('2026-11-19T20:04:05Z');

// En Tokio es el 23 de noviembre a las 04:45:12; en Colombia, el 22 a las 14:45.
const PRIMER_USO = Date.parse('2026-11-22T19:45:12Z');
const FECHA_DEL_PRIMER_USO = '2026-11-22T14:45:12-05:00';
const SEGUNDO_INTENTO = Date.parse('2026-11-22T20:10:00Z');
const TERCER_INTENTO = Date.parse('2026-11-22T21:30:00Z');

// Los nueve campos de la boleta, ordenados como los ordena `sort()`.
const CAMPOS_DE_LA_BOLETA = [
  'asientos',
  'ciudad',
  'codigo',
  'estado',
  'fechaUso',
  'inicio',
  'lugar',
  'nombre',
  'titulo',
];

// La función 1 es del evento 1 y cuesta 15.000.
const COMPRA_DE_ANA = {
  asientos: ['A1', 'A2'],
  nombre: '  Ana Pérez ',
  correo: ' ana@correo.co ',
};
const BOLETA_DE_ANA = {
  codigo: 'K7Q2M9XA',
  titulo: 'El Último Faro',
  inicio: '2026-11-21T18:00:00-05:00',
  lugar: 'Cine Club La Gaitana',
  ciudad: 'Neiva',
  asientos: ['A1', 'A2'],
  nombre: 'Ana Pérez',
  estado: 'valida',
  fechaUso: null,
};

// La función 5 es del evento 4, de otro lugar y de otra hora. Los asientos van
// en un orden que no es el del plano.
const COMPRA_DE_LUIS = {
  asientos: ['B2', 'A1', 'E1'],
  nombre: 'Luis Gómez',
  correo: 'luis@correo.co',
};
const BOLETA_DE_LUIS = {
  codigo: 'WXYZ5678',
  titulo: 'Cartas a Medianoche',
  inicio: '2026-11-21T16:00:00-05:00',
  lugar: 'Teatro Municipal de Neiva',
  ciudad: 'Neiva',
  asientos: ['B2', 'A1', 'E1'],
  nombre: 'Luis Gómez',
  estado: 'valida',
  fechaUso: null,
};

// Lo que un cliente podría cambiar de lo que recibe.
interface Modificable {
  codigo: string;
  asientos: string[];
  nombre: string;
  estado: string;
  fechaUso: string | null;
}

// El único doble de código: la clase real con `generar` reemplazado.
class GeneradorDePrueba extends GeneradorCodigo {
  constructor(private readonly siguiente: () => string) {
    super();
  }

  override generar(): string {
    return this.siguiente();
  }
}

// El único doble de hora: la clase real con `ahora` que se puede mover entre
// una llamada y otra.
class RelojAvanzable extends Reloj {
  constructor(public instante: number) {
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

// Servicios nuevos en cada prueba: los reales de funciones, eventos, asientos y
// compras, y solo el generador y el reloj son dobles. El reloj es uno solo,
// compartido por las compras y por las boletas, como en la aplicación.
function armar(
  siguiente: () => string = enSecuencia(['K7Q2M9XA', 'WXYZ5678']),
  instante: number = INSTANTE_DE_LA_COMPRA,
) {
  const funciones = new FuncionesService();
  const eventos = new EventosService(funciones);
  const asientos = new AsientosService(funciones, eventos);
  const reloj = new RelojAvanzable(instante);
  const compras = new ComprasService(
    funciones,
    asientos,
    new GeneradorDePrueba(siguiente),
    reloj,
  );
  const service = new BoletasService(compras, asientos, reloj);
  return { asientos, compras, reloj, service };
}

// Los ids de los asientos ocupados de una función, en el orden del plano.
const ocupadosDe = (asientos: AsientosService, funcionId: number) =>
  asientos
    .findAsientos(funcionId)
    .filter((asiento) => asiento.estado === 'ocupado')
    .map((asiento) => asiento.id);

// Ejecuta la acción y devuelve lo que lanzó. Si no lanza nada, la prueba falla:
// así un `validar` que no lanza, o que lanza más tarde (async), no pasa.
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

// 404 con el código en mayúsculas, que es el canónico.
function esperarNoExiste(
  accion: () => unknown,
  codigoCanonico: string,
  contexto = '',
) {
  const error = lanzado(accion, contexto);
  expect(error, contexto).toBeInstanceOf(NotFoundException);
  const noExiste = error as NotFoundException;
  expect(noExiste.getStatus(), contexto).toBe(404);
  expect(noExiste.getResponse(), contexto).toEqual({
    statusCode: 404,
    message: `La boleta ${codigoCanonico} no existe`,
    error: 'Not Found',
  });
}

// 409 con exactamente cuatro campos: el cuerpo de un 409 de la API.
function esperarYaUsada(
  accion: () => unknown,
  codigoCanonico: string,
  fechaUso: string,
  contexto = '',
) {
  const error = lanzado(accion, contexto);
  expect(error, contexto).toBeInstanceOf(ConflictException);
  const conflicto = error as ConflictException;
  expect(conflicto.getStatus(), contexto).toBe(409);
  const cuerpo = conflicto.getResponse();
  expect(cuerpo, contexto).toEqual({
    statusCode: 409,
    message: `La boleta ${codigoCanonico} ya fue usada`,
    error: 'Conflict',
    fechaUso,
  });
  expect(Object.keys(cuerpo as object).sort(), contexto).toEqual([
    'error',
    'fechaUso',
    'message',
    'statusCode',
  ]);
}

describe('BoletasService', () => {
  // CA-1 · los nueve campos, con los datos de la función y de su evento.
  it('findByCodigo devuelve la boleta: código, título, inicio, lugar, ciudad, asientos, nombre, estado «valida» y fechaUso null, y nada más', () => {
    const { compras, service } = armar();
    compras.crear(1, COMPRA_DE_ANA);
    compras.crear(5, COMPRA_DE_LUIS);

    // Se pide primero la segunda compra, de otra función y de otro evento: los
    // datos salen de la función de la compra, no de una fija.
    const luis = service.findByCodigo('WXYZ5678');
    expect(luis).toEqual(BOLETA_DE_LUIS);
    expect(Object.keys(luis).sort()).toEqual(CAMPOS_DE_LA_BOLETA);

    // El nombre sale recortado y los asientos, en el orden de la compra.
    const ana = service.findByCodigo('K7Q2M9XA');
    expect(ana).toEqual(BOLETA_DE_ANA);
    expect(Object.keys(ana).sort()).toEqual(CAMPOS_DE_LA_BOLETA);
    expect(ana.fechaUso).toBeNull();

    // Ni el correo, ni el total, ni la función, ni la fecha de la compra.
    expect(JSON.stringify(ana)).not.toContain('correo');
    expect(JSON.stringify(luis)).not.toContain('correo');
    expect(ana).not.toHaveProperty('total');
    expect(ana).not.toHaveProperty('funcionId');
    expect(ana).not.toHaveProperty('fecha');
  });

  // CA-1 · el 404, con el código en el mensaje.
  it('findByCodigo lanza 404 «La boleta ZZZZ9999 no existe» si ninguna compra tiene ese código', () => {
    // Sin ninguna compra guardada.
    esperarNoExiste(
      () => armar().service.findByCodigo('ZZZZ9999'),
      'ZZZZ9999',
      'sin compras',
    );

    // Con una compra que tiene otro código.
    const { compras, service } = armar();
    compras.crear(1, COMPRA_DE_ANA);
    esperarNoExiste(
      () => service.findByCodigo('ZZZZ9999'),
      'ZZZZ9999',
      'con otra compra',
    );
    // El mensaje lleva el código pedido, no uno fijo.
    esperarNoExiste(
      () => service.findByCodigo('ABCD1234'),
      'ABCD1234',
      'otro código',
    );
    // Un código que no tiene el formato de los de la API también es un 404.
    esperarNoExiste(() => service.findByCodigo('123'), '123', 'solo dígitos');
  });

  // CA-2 · el código en mayúsculas es la forma única.
  it('findByCodigo y validar aceptan el código en minúsculas o mezclado y responden con el código en mayúsculas', () => {
    const { compras, reloj, service } = armar(
      enSecuencia(['K7Q2M9XA', 'P3R8T5ZB']),
    );
    compras.crear(1, COMPRA_DE_ANA);
    compras.crear(1, { ...COMPRA_DE_LUIS, asientos: ['B1'] });

    // findByCodigo: la misma boleta, con el código canónico.
    expect(service.findByCodigo('k7q2m9xa')).toEqual(BOLETA_DE_ANA);
    expect(service.findByCodigo('K7q2M9xA')).toEqual(BOLETA_DE_ANA);
    expect(service.findByCodigo('k7q2m9xa').codigo).toBe('K7Q2M9XA');

    // validar en minúsculas: usa la boleta de K7Q2M9XA y responde con su código.
    reloj.instante = PRIMER_USO;
    const usada = service.validar('k7q2m9xa');
    expect(usada).toEqual({
      ...BOLETA_DE_ANA,
      estado: 'usada',
      fechaUso: FECHA_DEL_PRIMER_USO,
    });
    expect(usada.codigo).toBe('K7Q2M9XA');

    // Es la misma boleta, escrita como se escriba: ya está usada, y el 409
    // también lleva el código en mayúsculas.
    esperarYaUsada(
      () => service.validar('K7q2M9xA'),
      'K7Q2M9XA',
      FECHA_DEL_PRIMER_USO,
      'mezclado',
    );
    esperarYaUsada(
      () => service.validar('K7Q2M9XA'),
      'K7Q2M9XA',
      FECHA_DEL_PRIMER_USO,
      'en mayúsculas',
    );
    expect(service.findByCodigo('k7q2m9xa').estado).toBe('usada');

    // validar con un código mezclado, en una boleta que todavía no se usó.
    const otra = service.validar('P3r8T5zB');
    expect(otra.codigo).toBe('P3R8T5ZB');
    expect(otra.estado).toBe('usada');
    expect(service.findByCodigo('P3R8T5ZB').estado).toBe('usada');

    // El 404 de un código que no existe, escrito en minúsculas o mezclado,
    // también lleva el código en mayúsculas.
    for (const escrito of ['zzzz9999', 'ZzZz9999']) {
      esperarNoExiste(
        () => service.findByCodigo(escrito),
        'ZZZZ9999',
        `findByCodigo ${escrito}`,
      );
      esperarNoExiste(
        () => service.validar(escrito),
        'ZZZZ9999',
        `validar ${escrito}`,
      );
    }
  });

  // CA-3 · la fecha sale del reloj y va en hora de Colombia.
  it('validar marca la boleta como usada con la hora del reloj en hora de Colombia, la devuelve y findByCodigo la muestra usada', () => {
    const { compras, reloj, service } = armar();
    compras.crear(1, COMPRA_DE_ANA);
    compras.crear(5, COMPRA_DE_LUIS);
    expect(service.findByCodigo('K7Q2M9XA').estado).toBe('valida');

    // Pasan tres días entre la compra y la puerta.
    reloj.instante = PRIMER_USO;
    const usada = service.validar('K7Q2M9XA');

    // En Tokio serían las 04:45 del 23; en Colombia, las 14:45 del 22.
    expect(usada).toEqual({
      ...BOLETA_DE_ANA,
      estado: 'usada',
      fechaUso: FECHA_DEL_PRIMER_USO,
    });
    expect(Object.keys(usada).sort()).toEqual(CAMPOS_DE_LA_BOLETA);
    expect(JSON.stringify(usada)).not.toContain('correo');

    // Después, la lectura la muestra usada, con la misma fecha.
    const leida = service.findByCodigo('K7Q2M9XA');
    expect(leida).toEqual(usada);
    expect(leida.estado).toBe('usada');
    expect(leida.fechaUso).toBe(FECHA_DEL_PRIMER_USO);

    // Otra boleta, de otra función, un milisegundo antes de la medianoche de
    // Colombia: la fecha se corta, no se redondea, y se queda en el día 22.
    reloj.instante = Date.parse('2026-11-23T04:59:59.999Z');
    expect(service.validar('WXYZ5678')).toEqual({
      ...BOLETA_DE_LUIS,
      estado: 'usada',
      fechaUso: '2026-11-22T23:59:59-05:00',
    });

    // La primera no cambió.
    expect(service.findByCodigo('K7Q2M9XA').fechaUso).toBe(
      FECHA_DEL_PRIMER_USO,
    );
  });

  // CA-4 · el 409 lleva la fecha del primer uso y esa fecha no cambia.
  it('validar una boleta usada lanza 409 «La boleta K7Q2M9XA ya fue usada» con la fecha del primer uso, que no cambia aunque el reloj avance', () => {
    const { compras, reloj, service } = armar();
    compras.crear(1, COMPRA_DE_ANA);
    reloj.instante = PRIMER_USO;
    service.validar('K7Q2M9XA');

    // El reloj avanza y se vuelve a validar: 409 con la fecha del primer uso.
    reloj.instante = SEGUNDO_INTENTO;
    esperarYaUsada(
      () => service.validar('K7Q2M9XA'),
      'K7Q2M9XA',
      FECHA_DEL_PRIMER_USO,
      'segundo intento',
    );

    // Una tercera llamada, con el reloj más adelante, da el mismo 409.
    reloj.instante = TERCER_INTENTO;
    esperarYaUsada(
      () => service.validar('K7Q2M9XA'),
      'K7Q2M9XA',
      FECHA_DEL_PRIMER_USO,
      'tercer intento',
    );

    // Los intentos fallidos no reescribieron la fecha que muestra la boleta.
    const leida = service.findByCodigo('K7Q2M9XA');
    expect(leida.estado).toBe('usada');
    expect(leida.fechaUso).toBe(FECHA_DEL_PRIMER_USO);
  });

  // CA-4 · sin ningún `await` entre comprobar y marcar.
  it('validar es síncrono: devuelve la boleta y no una promesa, y la llamada siguiente ya ve el uso', () => {
    const { compras, reloj, service } = armar();
    compras.crear(1, COMPRA_DE_ANA);
    reloj.instante = PRIMER_USO;

    const resultado = service.validar('K7Q2M9XA');

    // No es una promesa ni nada que se pueda esperar.
    expect(resultado).not.toBeInstanceOf(Promise);
    expect((resultado as unknown as { then?: unknown }).then).toBeUndefined();
    expect(resultado.estado).toBe('usada');
    expect(resultado.fechaUso).toBe(FECHA_DEL_PRIMER_USO);

    // Sin ceder el turno, la lectura y la validación siguientes ya ven el uso:
    // dos validaciones seguidas no pueden dar las dos por buenas.
    const leida = service.findByCodigo('K7Q2M9XA');
    expect(leida).not.toBeInstanceOf(Promise);
    expect(leida.estado).toBe('usada');
    esperarYaUsada(
      () => service.validar('K7Q2M9XA'),
      'K7Q2M9XA',
      FECHA_DEL_PRIMER_USO,
    );

    // El 404 también se lanza en la misma llamada, no en una promesa.
    esperarNoExiste(() => service.validar('ZZZZ9999'), 'ZZZZ9999');
  });

  // CA-5 · el 404 no deja nada guardado.
  it('validar un código que no existe lanza 404 y no deja ningún uso: si después se compra con ese código, su boleta es válida', () => {
    const { compras, reloj, service } = armar(enSecuencia(['ZZZZ9999']));
    reloj.instante = PRIMER_USO;

    // Todavía no hay ninguna compra: el código no existe, escrito de las dos
    // formas.
    esperarNoExiste(
      () => service.validar('ZZZZ9999'),
      'ZZZZ9999',
      'mayúsculas',
    );
    esperarNoExiste(
      () => service.validar('zzzz9999'),
      'ZZZZ9999',
      'minúsculas',
    );

    // Ahora el generador da ese código y se compra.
    compras.crear(1, COMPRA_DE_ANA);

    // La boleta nace válida: el intento anterior no dejó un uso guardado.
    const nueva = service.findByCodigo('ZZZZ9999');
    expect(nueva).toEqual({ ...BOLETA_DE_ANA, codigo: 'ZZZZ9999' });
    expect(nueva.estado).toBe('valida');
    expect(nueva.fechaUso).toBeNull();

    // Y se puede validar: responde la boleta usada y no un 409.
    const usada = service.validar('ZZZZ9999');
    expect(usada.estado).toBe('usada');
    expect(usada.fechaUso).toBe(FECHA_DEL_PRIMER_USO);
  });

  // Sin criterio (D6): el uso es de una boleta, no de todas.
  it('validar una boleta no cambia la de otra compra', () => {
    // Las dos compras son de la misma función, la 1.
    const { compras, reloj, service } = armar(
      enSecuencia(['K7Q2M9XA', 'P3R8T5ZB']),
    );
    compras.crear(1, COMPRA_DE_ANA);
    compras.crear(1, {
      asientos: ['B1'],
      nombre: 'Luis Gómez',
      correo: 'luis@correo.co',
    });
    const boletaDeLuis = {
      ...BOLETA_DE_ANA,
      codigo: 'P3R8T5ZB',
      asientos: ['B1'],
      nombre: 'Luis Gómez',
    };

    reloj.instante = PRIMER_USO;
    service.validar('K7Q2M9XA');

    // La otra sigue válida, con todos sus datos.
    expect(service.findByCodigo('P3R8T5ZB')).toEqual(boletaDeLuis);

    // Y se puede validar con su propia fecha, sin un 409.
    reloj.instante = SEGUNDO_INTENTO;
    expect(service.validar('P3R8T5ZB')).toEqual({
      ...boletaDeLuis,
      estado: 'usada',
      fechaUso: '2026-11-22T15:10:00-05:00',
    });

    // Cada una conserva su fecha.
    expect(service.findByCodigo('K7Q2M9XA').fechaUso).toBe(
      FECHA_DEL_PRIMER_USO,
    );
    expect(service.findByCodigo('P3R8T5ZB').fechaUso).toBe(
      '2026-11-22T15:10:00-05:00',
    );
  });

  // Sin criterio (D2 y D6): lo que recibe quien llama no da acceso a lo guardado.
  it('modificar la boleta devuelta no altera la compra ni el uso guardados', () => {
    const { asientos, compras, reloj, service } = armar();
    compras.crear(1, COMPRA_DE_ANA);
    const compraGuardada = {
      codigo: 'K7Q2M9XA',
      funcionId: 1,
      asientos: ['A1', 'A2'],
      total: 30000,
      fecha: '2026-11-19T15:04:05-05:00',
      nombre: 'Ana Pérez',
      correo: 'ana@correo.co',
    };
    const usadaEsperada = {
      ...BOLETA_DE_ANA,
      estado: 'usada',
      fechaUso: FECHA_DEL_PRIMER_USO,
    };

    // Se cambia todo lo que devolvió findByCodigo.
    const leida: Modificable = service.findByCodigo('K7Q2M9XA');
    leida.asientos[0] = 'Z9';
    leida.asientos.push('E8');
    leida.codigo = 'XXXXXXXX';
    leida.nombre = 'Otro';
    leida.estado = 'usada';
    leida.fechaUso = 'ayer';

    // Otra lectura sigue igual, y la compra también.
    expect(service.findByCodigo('K7Q2M9XA')).toEqual(BOLETA_DE_ANA);
    expect(compras.findByCodigo('K7Q2M9XA')).toEqual(compraGuardada);
    // Y la boleta no pasó a estar usada por haberlo escrito en la copia.
    reloj.instante = PRIMER_USO;
    const devuelta: Modificable = service.validar('K7Q2M9XA');
    expect(devuelta).toEqual(usadaEsperada);

    // Se cambia lo que devolvió validar.
    devuelta.asientos[0] = 'Z9';
    devuelta.asientos.push('E8');
    devuelta.codigo = 'XXXXXXXX';
    devuelta.nombre = 'Otro';
    devuelta.estado = 'valida';
    devuelta.fechaUso = 'ayer';

    // El uso guardado no cambió: la lectura y el 409 dicen lo de siempre.
    expect(service.findByCodigo('K7Q2M9XA')).toEqual(usadaEsperada);
    reloj.instante = SEGUNDO_INTENTO;
    esperarYaUsada(
      () => service.validar('K7Q2M9XA'),
      'K7Q2M9XA',
      FECHA_DEL_PRIMER_USO,
    );

    // Cada lectura es un objeto nuevo, con una lista de asientos nueva.
    const una = service.findByCodigo('K7Q2M9XA');
    const otra = service.findByCodigo('K7Q2M9XA');
    expect(una).not.toBe(otra);
    expect(una.asientos).not.toBe(otra.asientos);
    expect(una.asientos).not.toBe(devuelta.asientos);

    // La compra no cambió, ni tiene un uso: Compra sigue con sus siete campos.
    expect(compras.findByCodigo('K7Q2M9XA')).toEqual(compraGuardada);
    expect(Object.keys(compras.findByCodigo('K7Q2M9XA') ?? {}).sort()).toEqual([
      'asientos',
      'codigo',
      'correo',
      'fecha',
      'funcionId',
      'nombre',
      'total',
    ]);
    // Validar la boleta no libera ni ocupa asientos.
    expect(ocupadosDe(asientos, 1)).toEqual(['A1', 'A2']);
  });
});
