import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { GeneradorCodigo } from './../src/compras/generador-codigo.js';
import { Reloj } from './../src/compras/reloj.js';

// Aquí no se fuerza la zona: la fecha sale de `Intl` con America/Bogota y la
// prueba exige el texto exacto con «-05:00». La zona forzada la prueba la
// unitaria del servicio.

const MENSAJE_DEL_PIPE = 'Validation failed (numeric string is expected)';

const INSTANTE = Date.parse('2026-11-19T20:04:05Z');
const FECHA_DEL_INSTANTE = '2026-11-19T15:04:05-05:00';

const COMPRADOR = { nombre: 'Ana Pérez', correo: 'ana@correo.co' };

// El plano del lugar, escrito a mano: cinco filas de ocho asientos.
const IDS_EN_ORDEN = [
  ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8'],
  ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8'],
  ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8'],
  ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8'],
  ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8'],
].flat();

const OCUPADOS_DE_LA_5 = ['A3', 'A4', 'C1', 'C8', 'D5', 'E8'];

const asientosEsperados = (ocupados: string[]) =>
  IDS_EN_ORDEN.map((id) => ({
    id,
    fila: id.slice(0, 1),
    numero: Number(id.slice(1)),
    estado: ocupados.includes(id) ? 'ocupado' : 'disponible',
  }));

// Un pedido válido, con los cambios que se pidan encima. Un valor `undefined`
// no viaja en el JSON: el campo queda ausente.
const pedido = (
  asientos: unknown,
  cambios: Record<string, unknown> = {},
): object => ({ asientos, ...COMPRADOR, ...cambios });

// Devuelve los códigos en el orden dado. Si se piden más, lanza: así una
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

describe('Compras (e2e)', () => {
  let abierta: INestApplication<App> | undefined;

  // Una aplicación nueva en cada prueba: la memoria empieza limpia. El
  // generador y el reloj se reemplazan con `overrideProvider`.
  async function levantar(
    codigo: () => string = enSecuencia(['K7Q2M9XA', 'P3R8T5ZB']),
    instante: number = INSTANTE,
  ): Promise<INestApplication<App>> {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(GeneradorCodigo)
      .useValue({ generar: codigo })
      .overrideProvider(Reloj)
      .useValue({ ahora: () => instante })
      .compile();

    const app: INestApplication<App> = moduleFixture.createNestApplication();
    await app.init();
    abierta = app;
    return app;
  }

  afterEach(async () => {
    await abierta?.close();
    abierta = undefined;
  });

  describe('POST /funciones/:id/compras', () => {
    // CA-1
    it('POST /funciones/1/compras responde 201 con el código, la función, los asientos, el total y la fecha', async () => {
      const app = await levantar();

      const res = await request(app.getHttpServer())
        .post('/funciones/1/compras')
        .send({
          asientos: ['A1', 'A2'],
          nombre: '  Ana Pérez ',
          correo: ' ana@correo.co ',
        })
        .expect(201)
        .expect('Content-Type', /json/);

      expect(res.body).toEqual({
        codigo: 'K7Q2M9XA',
        funcionId: 1,
        asientos: ['A1', 'A2'],
        total: 30000,
        fecha: FECHA_DEL_INSTANTE,
      });
      expect(Object.keys(res.body).sort()).toEqual([
        'asientos',
        'codigo',
        'fecha',
        'funcionId',
        'total',
      ]);
      expect(typeof res.body.total).toBe('number');
      expect(typeof res.body.funcionId).toBe('number');

      // La función 10 cuesta 8.000: seis asientos son 48.000.
      const diez = await request(app.getHttpServer())
        .post('/funciones/10/compras')
        .send(pedido(['A1', 'A2', 'A3', 'B1', 'B2', 'B3']))
        .expect(201);

      expect(diez.body).toEqual({
        codigo: 'P3R8T5ZB',
        funcionId: 10,
        asientos: ['A1', 'A2', 'A3', 'B1', 'B2', 'B3'],
        total: 48000,
        fecha: FECHA_DEL_INSTANTE,
      });
    });

    // CA-2
    it('después de comprar A1 y A2 de la función 1, GET /funciones/1/asientos los muestra ocupados y las funciones 2 y 5 no cambian', async () => {
      const app = await levantar();
      const antes = await request(app.getHttpServer())
        .get('/funciones/1/asientos')
        .expect(200);
      expect(antes.body).toEqual(asientosEsperados([]));

      await request(app.getHttpServer())
        .post('/funciones/1/compras')
        .send(pedido(['A1', 'A2']))
        .expect(201);

      const uno = await request(app.getHttpServer())
        .get('/funciones/1/asientos')
        .expect(200);
      expect(uno.body).toEqual(asientosEsperados(['A1', 'A2']));
      expect(uno.body[0]).toEqual({
        id: 'A1',
        fila: 'A',
        numero: 1,
        estado: 'ocupado',
      });

      const dos = await request(app.getHttpServer())
        .get('/funciones/2/asientos')
        .expect(200);
      expect(dos.body).toEqual(asientosEsperados([]));

      const cinco = await request(app.getHttpServer())
        .get('/funciones/5/asientos')
        .expect(200);
      expect(cinco.body).toEqual(asientosEsperados(OCUPADOS_DE_LA_5));
    });

    // CA-3
    it('POST con A3 y C1 ocupados en la función 5 responde 409 con esos asientos y no ocupa A1', async () => {
      // El mismo código en cada llamada: una compra que fallara y quedara
      // guardada haría que la siguiente no encontrara un código libre.
      const app = await levantar(() => 'AAAA1111');

      const res = await request(app.getHttpServer())
        .post('/funciones/5/compras')
        .send(pedido(['A1', 'A3', 'C1']))
        .expect(409)
        .expect('Content-Type', /json/);

      expect(res.body).toEqual({
        statusCode: 409,
        message: 'Estos asientos ya no están disponibles: A3, C1',
        error: 'Conflict',
        asientos: ['A3', 'C1'],
      });

      const mapa = await request(app.getHttpServer())
        .get('/funciones/5/asientos')
        .expect(200);
      expect(mapa.body).toEqual(asientosEsperados(OCUPADOS_DE_LA_5));
      expect(mapa.body[0]).toEqual({
        id: 'A1',
        fila: 'A',
        numero: 1,
        estado: 'disponible',
      });

      // Nada quedó a medias: A1 y B1 se pueden comprar después.
      await request(app.getHttpServer())
        .post('/funciones/5/compras')
        .send(pedido(['A1', 'B1']))
        .expect(201);
    });

    // CA-3
    it('dos compras simultáneas del mismo asiento: una responde 201, la otra 409, y solo quedan ocupados los de la primera', async () => {
      const app = await levantar(
        enSecuencia(['AAAA1111', 'BBBB2222', 'CCCC3333', 'DDDD4444']),
      );
      // Con el servidor escuchando, las dos peticiones usan el mismo puerto y
      // ninguna lo cierra al terminar.
      await app.listen(0);
      const pedidos = [
        ['A1', 'A2'],
        ['A2', 'A3'],
      ];

      const respuestas = await Promise.all(
        pedidos.map((asientos) =>
          request(app.getHttpServer())
            .post('/funciones/1/compras')
            .send(pedido(asientos)),
        ),
      );

      // La prueba no supone cuál llega primero: lo averigua por el estado.
      expect(respuestas.map((res) => res.status).sort((a, b) => a - b)).toEqual(
        [201, 409],
      );
      const ganadora = respuestas.findIndex((res) => res.status === 201);
      const perdedora = 1 - ganadora;

      expect(respuestas[ganadora].body).toEqual({
        codigo: expect.stringMatching(/^(AAAA1111|BBBB2222)$/),
        funcionId: 1,
        asientos: pedidos[ganadora],
        total: 30000,
        fecha: FECHA_DEL_INSTANTE,
      });
      // A2 es el asiento que las dos querían.
      expect(respuestas[perdedora].body).toEqual({
        statusCode: 409,
        message: 'Estos asientos ya no están disponibles: A2',
        error: 'Conflict',
        asientos: ['A2'],
      });

      // Solo están ocupados los de la ganadora; el exclusivo de la perdedora
      // (A3 o A1) está libre.
      const mapa = await request(app.getHttpServer())
        .get('/funciones/1/asientos')
        .expect(200);
      expect(mapa.body).toEqual(asientosEsperados(pedidos[ganadora]));
    });

    // CA-4
    it('POST con un cuerpo inválido responde 400 con el mensaje de la regla y no ocupa asientos', async () => {
      // El generador de prueba solo tiene dos códigos y aquí hay 20 rechazos:
      // un 400 que pidiera un código antes de validar agotaría el generador.
      const app = await levantar();
      const SIETE = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7'];
      // [qué se prueba, el cuerpo, el mensaje]
      const casos: Array<[string, object, string]> = [
        [
          'asientos que no es una lista',
          pedido('A1'),
          'La lista de asientos no es válida',
        ],
        [
          'asientos con un número',
          pedido(['A1', 2]),
          'La lista de asientos no es válida',
        ],
        [
          'asientos ausente',
          pedido(undefined),
          'La lista de asientos no es válida',
        ],
        ['cuerpo vacío', {}, 'La lista de asientos no es válida'],
        [
          'un arreglo en lugar de un objeto',
          ['A1'],
          'La lista de asientos no es válida',
        ],
        ['lista vacía', pedido([]), 'Elige al menos un asiento'],
        [
          'siete asientos',
          pedido(SIETE),
          'Puedes comprar máximo 6 boletas por compra',
        ],
        [
          'asiento repetido',
          pedido(['A1', 'A2', 'A1']),
          'El asiento A1 está repetido',
        ],
        [
          'asiento que no existe',
          pedido(['A1', 'Z9']),
          'El asiento Z9 no existe en el lugar',
        ],
        [
          'asiento en minúscula',
          pedido(['a1']),
          'El asiento a1 no existe en el lugar',
        ],
        [
          'nombre de solo espacios',
          pedido(['A1'], { nombre: '   ' }),
          'Escribe tu nombre completo',
        ],
        [
          'nombre ausente',
          pedido(['A1'], { nombre: undefined }),
          'Escribe tu nombre completo',
        ],
        [
          'nombre de 101 caracteres',
          pedido(['A1'], { nombre: 'N'.repeat(101) }),
          'El nombre admite máximo 100 caracteres',
        ],
        [
          'correo sin dominio',
          pedido(['A1'], { correo: 'ana@correo' }),
          'Escribe un correo electrónico válido',
        ],
        [
          'correo con un espacio',
          pedido(['A1'], { correo: 'ana correo@x.co' }),
          'Escribe un correo electrónico válido',
        ],
        [
          'correo ausente',
          pedido(['A1'], { correo: undefined }),
          'Escribe un correo electrónico válido',
        ],
        [
          'correo de 255 caracteres',
          pedido(['A1'], { correo: `${'a'.repeat(250)}@x.co` }),
          'Escribe un correo electrónico válido',
        ],
        // Fallan varias reglas a la vez: responde la primera.
        [
          'asientos y nombre malos a la vez',
          pedido(['Z9'], { nombre: '' }),
          'El asiento Z9 no existe en el lugar',
        ],
        [
          'nombre y correo malos a la vez',
          pedido(['A1'], { nombre: '', correo: 'x' }),
          'Escribe tu nombre completo',
        ],
      ];

      for (const [descripcion, cuerpo, mensaje] of casos) {
        const res = await request(app.getHttpServer())
          .post('/funciones/1/compras')
          .send(cuerpo)
          .expect(400)
          .expect('Content-Type', /json/);

        expect(res.body, descripcion).toEqual({
          statusCode: 400,
          message: mensaje,
          error: 'Bad Request',
        });
      }

      // Un POST sin cuerpo y sin tipo de contenido.
      const sinCuerpo = await request(app.getHttpServer())
        .post('/funciones/1/compras')
        .expect(400);
      expect(sinCuerpo.body).toEqual({
        statusCode: 400,
        message: 'La lista de asientos no es válida',
        error: 'Bad Request',
      });

      // Ninguno de los rechazos ocupó nada.
      const uno = await request(app.getHttpServer())
        .get('/funciones/1/asientos')
        .expect(200);
      expect(uno.body).toEqual(asientosEsperados([]));
      const cinco = await request(app.getHttpServer())
        .get('/funciones/5/asientos')
        .expect(200);
      expect(cinco.body).toEqual(asientosEsperados(OCUPADOS_DE_LA_5));
    });

    // CA-5
    it('POST /funciones/9999/compras responde 404 con «La función 9999 no existe», también con 0, -1 y un cuerpo inválido', async () => {
      const app = await levantar();

      for (const id of ['9999', '0', '-1']) {
        for (const cuerpo of [pedido(['A1']), {}, pedido([])]) {
          const res = await request(app.getHttpServer())
            .post(`/funciones/${id}/compras`)
            .send(cuerpo)
            .expect(404)
            .expect('Content-Type', /json/);

          expect(res.body, `función ${id}`).toEqual({
            statusCode: 404,
            message: `La función ${id} no existe`,
            error: 'Not Found',
          });
        }
      }

      // Sin cuerpo tampoco: el 404 sale antes de mirarlo.
      const sinCuerpo = await request(app.getHttpServer())
        .post('/funciones/9999/compras')
        .expect(404);
      expect(sinCuerpo.body).toEqual({
        statusCode: 404,
        message: 'La función 9999 no existe',
        error: 'Not Found',
      });
    });

    // CA-5
    it('POST /funciones/abc/compras responde 400 con el mensaje del pipe', async () => {
      const app = await levantar();

      for (const id of ['abc', '1.5']) {
        // Con un cuerpo válido y con uno inválido: el pipe va primero.
        for (const cuerpo of [pedido(['A1']), {}]) {
          const res = await request(app.getHttpServer())
            .post(`/funciones/${id}/compras`)
            .send(cuerpo)
            .expect(400);

          expect(res.body, `id ${id}`).toEqual({
            statusCode: 400,
            message: MENSAJE_DEL_PIPE,
            error: 'Bad Request',
          });
        }
      }

      // El pipe no dejó nada ocupado.
      const mapa = await request(app.getHttpServer())
        .get('/funciones/1/asientos')
        .expect(200);
      expect(mapa.body).toEqual(asientosEsperados([]));
    });

    // Sin criterio (D6)
    it('dos compras seguidas reciben códigos distintos aunque el generador repita uno', async () => {
      const app = await levantar(
        enSecuencia(['AAAA1111', 'AAAA1111', 'BBBB2222']),
      );

      const primera = await request(app.getHttpServer())
        .post('/funciones/1/compras')
        .send(pedido(['A1']))
        .expect(201);
      const segunda = await request(app.getHttpServer())
        .post('/funciones/1/compras')
        .send(pedido(['A2']))
        .expect(201);

      expect(primera.body.codigo).toBe('AAAA1111');
      expect(segunda.body.codigo).toBe('BBBB2222');
      expect(segunda.body.asientos).toEqual(['A2']);

      const mapa = await request(app.getHttpServer())
        .get('/funciones/1/asientos')
        .expect(200);
      expect(mapa.body).toEqual(asientosEsperados(['A1', 'A2']));
    });

    // Sin criterio (D6): el cuerpo del 500 del contrato.
    it('si el generador no consigue un código libre, POST responde 500 con el cuerpo del contrato y no ocupa asientos', async () => {
      const app = await levantar(() => 'AAAA1111');
      await request(app.getHttpServer())
        .post('/funciones/1/compras')
        .send(pedido(['A1']))
        .expect(201);

      const res = await request(app.getHttpServer())
        .post('/funciones/1/compras')
        .send(pedido(['B1', 'B2']))
        .expect(500)
        .expect('Content-Type', /json/);

      expect(res.body).toEqual({
        statusCode: 500,
        message: 'No se pudo generar un código de compra único',
        error: 'Internal Server Error',
      });
      const mapa = await request(app.getHttpServer())
        .get('/funciones/1/asientos')
        .expect(200);
      expect(mapa.body).toEqual(asientosEsperados(['A1']));
    });
  });

  // CA-1 · sin `overrideProvider`: el generador y el reloj reales están
  // cableados en el módulo.
  describe('con el generador y el reloj reales', () => {
    it('sin reemplazar el generador ni el reloj, el código tiene 8 caracteres de A-Z y 0-9 y la fecha termina en -05:00', async () => {
      const moduleFixture = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      const app: INestApplication<App> = moduleFixture.createNestApplication();
      await app.init();
      abierta = app;

      const antes = Date.now();
      const primera = await request(app.getHttpServer())
        .post('/funciones/1/compras')
        .send(pedido(['A1', 'A2']))
        .expect(201);
      const despues = Date.now();
      const segunda = await request(app.getHttpServer())
        .post('/funciones/1/compras')
        .send(pedido(['B1']))
        .expect(201);

      expect(primera.body.codigo).toMatch(/^[A-Z0-9]{8}$/);
      expect(segunda.body.codigo).toMatch(/^[A-Z0-9]{8}$/);
      expect(segunda.body.codigo).not.toBe(primera.body.codigo);
      expect(primera.body.fecha).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-05:00$/,
      );
      expect(primera.body.total).toBe(30000);
      expect(segunda.body.total).toBe(15000);

      // La fecha es la de ahora, sin los milisegundos.
      const instante = Date.parse(primera.body.fecha);
      expect(instante).toBeGreaterThanOrEqual(Math.floor(antes / 1000) * 1000);
      expect(instante).toBeLessThanOrEqual(despues);
    });
  });
});
