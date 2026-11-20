import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { GeneradorCodigo } from './../src/compras/generador-codigo.js';
import { Reloj } from './../src/compras/reloj.js';

// La fecha de uso va en hora de Colombia. En el hilo principal las pruebas
// corren en Asia/Tokyo, 14 h por delante de Colombia, para que un código que
// use la hora local del servidor dé otro día y otra hora. La zona se asigna en
// vi.hoisted, que corre antes de los import: si se asignara después, los
// formateadores de hora-colombia.ts ya estarían creados y la prueba no
// protegería nada. vi.hoisted no puede usar los import del archivo, así que
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

// La compra se hace un día y la boleta se usa días después: así una fecha de
// uso que saliera de la fecha de la compra no se confunde con la buena. En
// Tokio, PRIMER_USO es el 23 de noviembre a las 04:45; en Colombia, el 22 a las
// 14:45.
const INSTANTE_DE_LA_COMPRA = Date.parse('2026-11-19T20:04:05Z');
const PRIMER_USO = Date.parse('2026-11-22T19:45:12Z');
const FECHA_DEL_PRIMER_USO = '2026-11-22T14:45:12-05:00';
const SEGUNDO_INTENTO = Date.parse('2026-11-22T20:10:00Z');
const TERCER_INTENTO = Date.parse('2026-11-22T21:30:00Z');

const COMPRADOR = { nombre: 'Ana Pérez', correo: 'ana@correo.co' };

// La compra de las pruebas: la función 2 es del evento 1, y D1 y D2 están libres.
const ASIENTOS_COMPRADOS = ['D1', 'D2'];

// La boleta del contrato, tal cual.
const BOLETA_VALIDA = {
  codigo: 'K7Q2M9XA',
  titulo: 'El Último Faro',
  inicio: '2026-11-22T15:00:00-05:00',
  lugar: 'Cine Club La Gaitana',
  ciudad: 'Neiva',
  asientos: ['D1', 'D2'],
  nombre: 'Ana Pérez',
  estado: 'valida',
  fechaUso: null,
};

const BOLETA_USADA = {
  ...BOLETA_VALIDA,
  estado: 'usada',
  fechaUso: FECHA_DEL_PRIMER_USO,
};

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

// Los cuerpos de error del contrato.
const NO_EXISTE = (codigo: string) => ({
  statusCode: 404,
  message: `La boleta ${codigo} no existe`,
  error: 'Not Found',
});

const YA_USADA = (codigo: string, fechaUso: string) => ({
  statusCode: 409,
  message: `La boleta ${codigo} ya fue usada`,
  error: 'Conflict',
  fechaUso,
});

// Un reloj que se puede mover entre una petición y otra.
function relojQueAvanza(inicial: number) {
  let instante = inicial;
  return {
    ahora: () => instante,
    fijar: (nuevo: number) => {
      instante = nuevo;
    },
  };
}

describe('Boletas (e2e)', () => {
  let abierta: INestApplication<App> | undefined;

  // Una aplicación nueva en cada prueba: la memoria empieza limpia. El
  // generador y el reloj se reemplazan con `overrideProvider`. ComprasModule
  // exporta el reloj y BoletasModule lo usa: es la misma instancia, así que un
  // solo `overrideProvider(Reloj)` cubre la compra y el ingreso.
  async function levantar(
    codigo: () => string,
    reloj: { ahora: () => number },
  ): Promise<INestApplication<App>> {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(GeneradorCodigo)
      .useValue({ generar: codigo })
      .overrideProvider(Reloj)
      .useValue(reloj)
      .compile();

    const app: INestApplication<App> = moduleFixture.createNestApplication();
    await app.init();
    abierta = app;
    return app;
  }

  // La compra que da la boleta K7Q2M9XA: la hace la API real, por HTTP.
  async function comprar(app: INestApplication<App>) {
    const res = await request(app.getHttpServer())
      .post('/funciones/2/compras')
      .send({ asientos: ASIENTOS_COMPRADOS, ...COMPRADOR })
      .expect(201);
    expect(res.body.codigo).toBe('K7Q2M9XA');
  }

  afterEach(async () => {
    await abierta?.close();
    abierta = undefined;
  });

  describe('GET /boletas/:codigo', () => {
    // CA-1
    it('GET /boletas/K7Q2M9XA responde 200 con los nueve campos de la boleta y sin el correo', async () => {
      const app = await levantar(
        () => 'K7Q2M9XA',
        relojQueAvanza(INSTANTE_DE_LA_COMPRA),
      );
      await comprar(app);

      const res = await request(app.getHttpServer())
        .get('/boletas/K7Q2M9XA')
        .expect(200)
        .expect('Content-Type', /json/);

      expect(res.body).toEqual(BOLETA_VALIDA);
      expect(Object.keys(res.body).sort()).toEqual(CAMPOS_DE_LA_BOLETA);
      expect(res.body.fechaUso).toBeNull();
      // El correo no aparece en ningún lugar: ni como campo ni como valor.
      expect(JSON.stringify(res.body)).not.toContain('correo');

      // Leer la boleta no la usa: la segunda lectura sigue válida.
      const otraVez = await request(app.getHttpServer())
        .get('/boletas/K7Q2M9XA')
        .expect(200);
      expect(otraVez.body).toEqual(BOLETA_VALIDA);
    });

    // CA-1
    it('GET /boletas/ZZZZ9999 responde 404 con «La boleta ZZZZ9999 no existe»', async () => {
      const app = await levantar(
        () => 'K7Q2M9XA',
        relojQueAvanza(INSTANTE_DE_LA_COMPRA),
      );
      // Con una compra hecha: el 404 es de ese código, no de toda la ruta.
      await comprar(app);

      const res = await request(app.getHttpServer())
        .get('/boletas/ZZZZ9999')
        .expect(404)
        .expect('Content-Type', /json/);

      expect(res.body).toEqual(NO_EXISTE('ZZZZ9999'));

      // El mensaje lleva el código pedido, en mayúsculas, escrito como se
      // escriba, y un código con otro formato no es un 400: es un 404.
      const casos: Array<[string, string]> = [
        ['zzzz9999', 'ZZZZ9999'],
        ['ABCD1234', 'ABCD1234'],
        ['abc', 'ABC'],
        ['123', '123'],
      ];
      for (const [escrito, canonico] of casos) {
        const otro = await request(app.getHttpServer())
          .get(`/boletas/${escrito}`)
          .expect(404);
        expect(otro.body, escrito).toEqual(NO_EXISTE(canonico));
      }
    });

    // CA-2
    it('GET /boletas/k7q2m9xa y /boletas/K7q2M9xA responden la boleta K7Q2M9XA, y POST /boletas/k7q2m9xa/ingreso la valida', async () => {
      const reloj = relojQueAvanza(INSTANTE_DE_LA_COMPRA);
      const app = await levantar(() => 'K7Q2M9XA', reloj);
      await comprar(app);

      for (const escrito of ['k7q2m9xa', 'K7q2M9xA']) {
        const res = await request(app.getHttpServer())
          .get(`/boletas/${escrito}`)
          .expect(200);
        // El código de la respuesta es el canónico, no el que se escribió.
        expect(res.body, escrito).toEqual(BOLETA_VALIDA);
      }

      // Validar con el código en minúsculas usa la boleta K7Q2M9XA.
      reloj.fijar(PRIMER_USO);
      const usada = await request(app.getHttpServer())
        .post('/boletas/k7q2m9xa/ingreso')
        .expect(200);
      expect(usada.body).toEqual(BOLETA_USADA);

      // Es la misma boleta, escrita como se escriba: la lectura en mayúsculas
      // la ve usada, y validar de nuevo con otra forma del código da el 409 con
      // el código en mayúsculas.
      const leida = await request(app.getHttpServer())
        .get('/boletas/K7Q2M9XA')
        .expect(200);
      expect(leida.body).toEqual(BOLETA_USADA);

      reloj.fijar(SEGUNDO_INTENTO);
      const repetida = await request(app.getHttpServer())
        .post('/boletas/K7q2M9xA/ingreso')
        .expect(409);
      expect(repetida.body).toEqual(YA_USADA('K7Q2M9XA', FECHA_DEL_PRIMER_USO));
    });
  });

  describe('POST /boletas/:codigo/ingreso', () => {
    // CA-3
    it('POST /boletas/K7Q2M9XA/ingreso responde 200 (no 201) con la boleta usada y su fecha de uso, y GET la muestra usada', async () => {
      const reloj = relojQueAvanza(INSTANTE_DE_LA_COMPRA);
      const app = await levantar(() => 'K7Q2M9XA', reloj);
      await comprar(app);
      reloj.fijar(PRIMER_USO);

      // Sin cuerpo: la ruta no pide nada.
      const res = await request(app.getHttpServer()).post(
        '/boletas/K7Q2M9XA/ingreso',
      );

      // POST responde 201 por defecto: aquí tiene que ser exactamente 200.
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/json/);
      expect(res.body).toEqual(BOLETA_USADA);
      expect(Object.keys(res.body).sort()).toEqual(CAMPOS_DE_LA_BOLETA);
      expect(JSON.stringify(res.body)).not.toContain('correo');

      // Después, GET la muestra usada, con la misma fecha.
      const leida = await request(app.getHttpServer())
        .get('/boletas/K7Q2M9XA')
        .expect(200);
      expect(leida.body).toEqual(BOLETA_USADA);
    });

    // CA-4
    it('una segunda validación responde 409 con «La boleta K7Q2M9XA ya fue usada» y la fecha del primer uso, que no cambia', async () => {
      const reloj = relojQueAvanza(INSTANTE_DE_LA_COMPRA);
      const app = await levantar(() => 'K7Q2M9XA', reloj);
      await comprar(app);
      reloj.fijar(PRIMER_USO);
      await request(app.getHttpServer())
        .post('/boletas/K7Q2M9XA/ingreso')
        .expect(200);

      // El reloj avanzó: el 409 lleva la fecha del primer uso, no la de ahora.
      reloj.fijar(SEGUNDO_INTENTO);
      const segunda = await request(app.getHttpServer())
        .post('/boletas/K7Q2M9XA/ingreso')
        .expect(409)
        .expect('Content-Type', /json/);
      expect(segunda.body).toEqual(YA_USADA('K7Q2M9XA', FECHA_DEL_PRIMER_USO));
      expect(Object.keys(segunda.body).sort()).toEqual([
        'error',
        'fechaUso',
        'message',
        'statusCode',
      ]);

      // Una tercera, con el reloj más adelante, da el mismo 409.
      reloj.fijar(TERCER_INTENTO);
      const tercera = await request(app.getHttpServer())
        .post('/boletas/K7Q2M9XA/ingreso')
        .expect(409);
      expect(tercera.body).toEqual(YA_USADA('K7Q2M9XA', FECHA_DEL_PRIMER_USO));

      // Y la boleta sigue mostrando la fecha del primer uso.
      const leida = await request(app.getHttpServer())
        .get('/boletas/K7Q2M9XA')
        .expect(200);
      expect(leida.body).toEqual(BOLETA_USADA);
    });

    // CA-4
    it('dos validaciones simultáneas de la misma boleta: una responde 200 y la otra 409, con la misma fecha de uso', async () => {
      // Un reloj que da una hora distinta en cada lectura: si la que pierde la
      // carrera leyera el reloj y reescribiera la fecha, las dos fechas
      // diferirían.
      let lecturas = 0;
      const reloj = {
        ahora: () => {
          const instante = PRIMER_USO + lecturas * 60_000;
          lecturas += 1;
          return instante;
        },
      };
      const app = await levantar(() => 'K7Q2M9XA', reloj);
      await comprar(app);
      // Con el servidor escuchando, las dos peticiones usan el mismo puerto y
      // ninguna lo cierra al terminar.
      await app.listen(0);

      const respuestas = await Promise.all(
        [0, 1].map(() =>
          request(app.getHttpServer()).post('/boletas/K7Q2M9XA/ingreso'),
        ),
      );

      // La prueba no supone cuál llega primero: lo averigua por el estado.
      expect(respuestas.map((res) => res.status).sort((a, b) => a - b)).toEqual(
        [200, 409],
      );
      const ganadora = respuestas.findIndex((res) => res.status === 200);
      const perdedora = 1 - ganadora;

      // La fecha es la del reloj de la prueba, en hora de Colombia: entre la
      // lectura de la compra (19:45:12 UTC) y dos minutos después.
      const fechaUso: string = respuestas[ganadora].body.fechaUso;
      expect(fechaUso).toMatch(/^2026-11-22T14:4[5-7]:12-05:00$/);
      expect(respuestas[ganadora].body).toEqual({
        ...BOLETA_USADA,
        fechaUso,
      });
      // La que perdió lleva la fecha de la que ganó.
      expect(respuestas[perdedora].body).toEqual(
        YA_USADA('K7Q2M9XA', fechaUso),
      );

      // Y la boleta quedó usada una sola vez, con esa fecha.
      const leida = await request(app.getHttpServer())
        .get('/boletas/K7Q2M9XA')
        .expect(200);
      expect(leida.body).toEqual({ ...BOLETA_USADA, fechaUso });
    });

    // CA-5
    it('POST /boletas/ZZZZ9999/ingreso responde 404 con «La boleta ZZZZ9999 no existe»', async () => {
      const reloj = relojQueAvanza(INSTANTE_DE_LA_COMPRA);
      const app = await levantar(() => 'K7Q2M9XA', reloj);
      // Con una compra hecha: el 404 es de ese código, no de toda la ruta.
      await comprar(app);
      reloj.fijar(PRIMER_USO);

      const res = await request(app.getHttpServer())
        .post('/boletas/ZZZZ9999/ingreso')
        .expect(404)
        .expect('Content-Type', /json/);

      expect(res.body).toEqual(NO_EXISTE('ZZZZ9999'));

      // El mensaje lleva el código en mayúsculas, escrito como se escriba, y
      // un código con otro formato no es un 400: es un 404.
      const casos: Array<[string, string]> = [
        ['zzzz9999', 'ZZZZ9999'],
        ['abc', 'ABC'],
        ['123', '123'],
      ];
      for (const [escrito, canonico] of casos) {
        const otro = await request(app.getHttpServer())
          .post(`/boletas/${escrito}/ingreso`)
          .expect(404);
        expect(otro.body, escrito).toEqual(NO_EXISTE(canonico));
      }

      // Los intentos no tocaron la boleta que sí existe.
      const leida = await request(app.getHttpServer())
        .get('/boletas/K7Q2M9XA')
        .expect(200);
      expect(leida.body).toEqual(BOLETA_VALIDA);
    });
  });

  // CA-3 · sin `overrideProvider(Reloj)`: el reloj real está cableado en el
  // módulo de boletas. El generador sí se reemplaza, para conocer el código.
  describe('con el reloj real', () => {
    it('con el reloj real, la fecha de uso es la de ahora y termina en -05:00', async () => {
      const moduleFixture = await Test.createTestingModule({
        imports: [AppModule],
      })
        .overrideProvider(GeneradorCodigo)
        .useValue({ generar: () => 'K7Q2M9XA' })
        .compile();
      const app: INestApplication<App> = moduleFixture.createNestApplication();
      await app.init();
      abierta = app;
      await comprar(app);

      const antes = Date.now();
      const res = await request(app.getHttpServer()).post(
        '/boletas/K7Q2M9XA/ingreso',
      );
      const despues = Date.now();

      expect(res.status).toBe(200);
      expect(res.body.estado).toBe('usada');
      const fechaUso: string = res.body.fechaUso;
      expect(fechaUso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-05:00$/);

      // La fecha es la de ahora, sin los milisegundos: se descartan, así que
      // puede quedar hasta un segundo antes de `antes` y nunca después de
      // `despues`. Se compara el instante, no el texto: con la zona del proceso
      // en Tokio, una hora local escrita con «-05:00» queda 14 h corrida.
      const instante = Date.parse(fechaUso);
      expect(instante).toBeGreaterThanOrEqual(Math.floor(antes / 1000) * 1000);
      expect(instante).toBeLessThanOrEqual(despues);

      // La lectura muestra esa misma fecha, y el 409 también.
      const leida = await request(app.getHttpServer())
        .get('/boletas/K7Q2M9XA')
        .expect(200);
      expect(leida.body.estado).toBe('usada');
      expect(leida.body.fechaUso).toBe(fechaUso);

      const repetida = await request(app.getHttpServer())
        .post('/boletas/K7Q2M9XA/ingreso')
        .expect(409);
      expect(repetida.body).toEqual(YA_USADA('K7Q2M9XA', fechaUso));
    });
  });
});
