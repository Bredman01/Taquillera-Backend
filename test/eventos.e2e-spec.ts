import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';

const CAMPOS_DEL_EVENTO = [
  'categoria',
  'ciudad',
  'clasificacion',
  'descripcion',
  'duracionMinutos',
  'id',
  'imagenUrl',
  'lugar',
  'titulo',
];

const TODOS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const ids = (cuerpo: Array<{ id: number }>): number[] =>
  cuerpo.map((evento) => evento.id);

const MENSAJE_DEL_PIPE = 'Validation failed (numeric string is expected)';

describe('Eventos (e2e)', () => {
  let app: INestApplication<App>;

  // D5: las pruebas corren en Asia/Tokyo, 14 h por delante de Colombia, para
  // que un filtro por fecha que use la hora local del servidor dé otro día.
  // La e2e corre en el hilo principal, así que no necesita la guarda de los
  // unitarios.
  const zonaOriginal = process.env.TZ;

  beforeAll(() => {
    process.env.TZ = 'Asia/Tokyo';
  });

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

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /eventos', () => {
    it('GET /eventos responde 200 con los 10 eventos y exactamente sus nueve campos', async () => {
      const res = await request(app.getHttpServer())
        .get('/eventos')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(10);
      expect(ids(res.body)).toEqual(TODOS);

      for (const evento of res.body) {
        expect(Object.keys(evento).sort()).toEqual(CAMPOS_DEL_EVENTO);
        expect(typeof evento.id).toBe('number');
        expect(typeof evento.titulo).toBe('string');
        expect(typeof evento.descripcion).toBe('string');
        expect(['cine', 'teatro', 'concierto', 'charla']).toContain(
          evento.categoria,
        );
        expect(typeof evento.ciudad).toBe('string');
        expect(typeof evento.lugar).toBe('string');
        expect(typeof evento.duracionMinutos).toBe('number');
        expect(['TP', '+7', '+13', '+16', '+18']).toContain(
          evento.clasificacion,
        );
        expect(evento.imagenUrl).toMatch(/^https:\/\/placehold\.co\//);
      }

      expect(res.body[3]).toMatchObject({
        id: 4,
        titulo: 'Cartas a Medianoche',
        categoria: 'teatro',
        ciudad: 'Neiva',
        lugar: 'Teatro Municipal de Neiva',
        duracionMinutos: 90,
        clasificacion: '+13',
      });
    });

    it('GET /eventos?categoria=teatro&ciudad=Neiva responde 200 solo con el evento 4', async () => {
      const res = await request(app.getHttpServer())
        .get('/eventos?categoria=teatro&ciudad=Neiva')
        .expect(200);

      expect(ids(res.body)).toEqual([4]);
      expect(res.body[0].titulo).toBe('Cartas a Medianoche');
    });

    it('GET /eventos?ciudad=bogota y ?ciudad=Bogot%C3%A1 responden 200 con los eventos de Bogotá', async () => {
      const sinTilde = await request(app.getHttpServer())
        .get('/eventos?ciudad=bogota')
        .expect(200);
      expect(ids(sinTilde.body)).toEqual([2, 5, 9]);

      const conTilde = await request(app.getHttpServer())
        .get('/eventos?ciudad=Bogot%C3%A1')
        .expect(200);
      expect(ids(conTilde.body)).toEqual([2, 5, 9]);
    });

    it('GET /eventos?categoria=&ciudad= responde 200 con los 10 eventos porque un filtro vacío no filtra', async () => {
      const res = await request(app.getHttpServer())
        .get('/eventos?categoria=&ciudad=')
        .expect(200);

      expect(ids(res.body)).toEqual(TODOS);
    });

    it('GET /eventos?categoria=magia responde 400', async () => {
      const res = await request(app.getHttpServer())
        .get('/eventos?categoria=magia')
        .expect(400);

      expect(res.body).toEqual({
        statusCode: 400,
        message: 'La categoría magia no existe',
        error: 'Bad Request',
      });
    });

    it('GET /eventos?ciudad=Medellín responde 200 con una lista vacía', async () => {
      const res = await request(app.getHttpServer())
        .get(`/eventos?ciudad=${encodeURIComponent('Medellín')}`)
        .expect(200);

      expect(res.body).toEqual([]);
    });

    it('GET /eventos?ciudad=Neiva&ciudad=Bogotá responde 400 porque cada filtro admite un solo valor', async () => {
      const res = await request(app.getHttpServer())
        .get(`/eventos?ciudad=Neiva&ciudad=${encodeURIComponent('Bogotá')}`)
        .expect(400);

      expect(res.body).toEqual({
        statusCode: 400,
        message: 'Cada filtro admite un solo valor',
        error: 'Bad Request',
      });
    });

    it('GET /eventos?fecha=2026-11-21 responde 200 con los eventos que tienen función ese día en hora de Colombia', async () => {
      const todos = await request(app.getHttpServer())
        .get('/eventos')
        .expect(200);
      const res = await request(app.getHttpServer())
        .get('/eventos?fecha=2026-11-21')
        .expect(200);

      // El 5 tiene su función a las 8:00 p. m.: en UTC ya sería el día 22.
      expect(ids(res.body)).toEqual([1, 4, 5, 6]);
      // Los eventos salen completos y con sus nueve campos, no solo los ids.
      expect(res.body).toEqual(
        todos.body.filter((evento: { id: number }) =>
          [1, 4, 5, 6].includes(evento.id),
        ),
      );
      for (const evento of res.body) {
        expect(Object.keys(evento).sort()).toEqual(CAMPOS_DEL_EVENTO);
      }
    });

    it('GET /eventos?fecha=2026-11-22 y ?fecha=2026-11-23 cuentan el día en hora de Colombia, no en UTC', async () => {
      const domingo = await request(app.getHttpServer())
        .get('/eventos?fecha=2026-11-22')
        .expect(200);
      expect(ids(domingo.body)).toEqual([1, 4, 6, 7, 8]);

      // Con UTC darían [4, 7] y con la hora de Tokio, [1, 4, 6, 7, 8].
      const lunes = await request(app.getHttpServer())
        .get('/eventos?fecha=2026-11-23')
        .expect(200);
      expect(lunes.body).toEqual([]);
    });

    it('GET /eventos?categoria=teatro&ciudad=Neiva&fecha=2026-11-22 responde 200 solo con el evento 4', async () => {
      const res = await request(app.getHttpServer())
        .get('/eventos?categoria=teatro&ciudad=Neiva&fecha=2026-11-22')
        .expect(200);

      expect(ids(res.body)).toEqual([4]);
      expect(res.body[0].titulo).toBe('Cartas a Medianoche');

      // Sin la fecha esta consulta también daría [4]: el filtro de fecha solo
      // se prueba si otro día deja la lista vacía. Con UTC, el 23 daría [4].
      const otroDia = await request(app.getHttpServer())
        .get('/eventos?categoria=teatro&ciudad=Neiva&fecha=2026-11-23')
        .expect(200);
      expect(otroDia.body).toEqual([]);

      // Y la fecha tampoco deja pasar a los eventos de otra categoría.
      const concierto = await request(app.getHttpServer())
        .get('/eventos?categoria=concierto&fecha=2026-11-22')
        .expect(200);
      expect(ids(concierto.body)).toEqual([6, 7]);
    });

    it('GET /eventos?fecha=21-11-2026 y ?fecha=2026-02-30 responden 400 con «La fecha … no es válida»', async () => {
      for (const fecha of ['21-11-2026', '2026-02-30']) {
        const res = await request(app.getHttpServer())
          .get(`/eventos?fecha=${fecha}`)
          .expect(400);

        expect(res.body).toEqual({
          statusCode: 400,
          message: `La fecha ${fecha} no es válida`,
          error: 'Bad Request',
        });
      }
    });

    it('GET /eventos?fecha= responde 200 con los 10 eventos porque una fecha vacía no filtra', async () => {
      const res = await request(app.getHttpServer())
        .get('/eventos?fecha=')
        .expect(200);

      expect(ids(res.body)).toEqual(TODOS);
    });

    it('GET /eventos?fecha=2026-11-21&fecha=2026-11-22 responde 400 porque cada filtro admite un solo valor', async () => {
      const res = await request(app.getHttpServer())
        .get('/eventos?fecha=2026-11-21&fecha=2026-11-22')
        .expect(400);

      expect(res.body).toEqual({
        statusCode: 400,
        message: 'Cada filtro admite un solo valor',
        error: 'Bad Request',
      });
    });
  });

  describe('GET /eventos/ciudades', () => {
    it('GET /eventos/ciudades responde 200 con las ciudades sin repetir y en orden alfabético', async () => {
      // Si `ciudades` se declarara después de `:id`, ParseIntPipe respondería
      // 400 y esta petición no llegaría al 200.
      const res = await request(app.getHttpServer())
        .get('/eventos/ciudades')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toEqual(['Bogotá', 'Íquira', 'Neiva', 'Pitalito']);
    });
  });

  describe('GET /eventos/:id', () => {
    it('GET /eventos/4 responde 200 con el evento', async () => {
      const res = await request(app.getHttpServer())
        .get('/eventos/4')
        .expect(200);

      expect(Object.keys(res.body).sort()).toEqual(CAMPOS_DEL_EVENTO);
      expect(res.body).toMatchObject({
        id: 4,
        titulo: 'Cartas a Medianoche',
        categoria: 'teatro',
        ciudad: 'Neiva',
        lugar: 'Teatro Municipal de Neiva',
        duracionMinutos: 90,
        clasificacion: '+13',
      });
      expect(res.body.imagenUrl).toMatch(/^https:\/\/placehold\.co\//);
    });

    it('GET /eventos/9999 responde 404 con «El evento 9999 no existe»', async () => {
      const res = await request(app.getHttpServer())
        .get('/eventos/9999')
        .expect(404);

      expect(res.body).toEqual({
        statusCode: 404,
        message: 'El evento 9999 no existe',
        error: 'Not Found',
      });
    });

    it('GET /eventos/0 y GET /eventos/-1 responden 404 con el mensaje del evento que no existe', async () => {
      const cero = await request(app.getHttpServer())
        .get('/eventos/0')
        .expect(404);
      expect(cero.body.message).toBe('El evento 0 no existe');

      const negativo = await request(app.getHttpServer())
        .get('/eventos/-1')
        .expect(404);
      expect(negativo.body.message).toBe('El evento -1 no existe');
    });

    it('GET /eventos/abc y GET /eventos/1.5 responden 400', async () => {
      for (const ruta of ['/eventos/abc', '/eventos/1.5']) {
        const res = await request(app.getHttpServer()).get(ruta).expect(400);

        expect(res.body).toEqual({
          statusCode: 400,
          message: 'Validation failed (numeric string is expected)',
          error: 'Bad Request',
        });
      }
    });
  });

  describe('GET /eventos/:id/funciones', () => {
    it('GET /eventos/4/funciones responde 200 con sus tres funciones en orden de inicio y exactamente sus cuatro campos', async () => {
      const res = await request(app.getHttpServer())
        .get('/eventos/4/funciones')
        .expect(200);

      expect(res.body).toEqual([
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
      for (const funcion of res.body) {
        expect(Object.keys(funcion).sort()).toEqual([
          'eventoId',
          'id',
          'inicio',
          'precio',
        ]);
      }
    });

    it('GET /eventos/10/funciones responde 200 con una lista vacía', async () => {
      // El evento 10 existe y no tiene funciones: no es un 404.
      const res = await request(app.getHttpServer())
        .get('/eventos/10/funciones')
        .expect(200);

      expect(res.body).toEqual([]);
    });

    it('GET /eventos/9999/funciones responde 404 con «El evento 9999 no existe»', async () => {
      const res = await request(app.getHttpServer())
        .get('/eventos/9999/funciones')
        .expect(404);

      expect(res.body).toEqual({
        statusCode: 404,
        message: 'El evento 9999 no existe',
        error: 'Not Found',
      });
    });

    it('GET /eventos/0/funciones y GET /eventos/-1/funciones responden 404 con el mensaje del evento que no existe', async () => {
      for (const id of ['0', '-1']) {
        const res = await request(app.getHttpServer())
          .get(`/eventos/${id}/funciones`)
          .expect(404);

        expect(res.body).toEqual({
          statusCode: 404,
          message: `El evento ${id} no existe`,
          error: 'Not Found',
        });
      }
    });

    it('GET /eventos/abc/funciones y GET /eventos/1.5/funciones responden 400', async () => {
      for (const ruta of ['/eventos/abc/funciones', '/eventos/1.5/funciones']) {
        const res = await request(app.getHttpServer()).get(ruta).expect(400);

        expect(res.body).toEqual({
          statusCode: 400,
          message: MENSAJE_DEL_PIPE,
          error: 'Bad Request',
        });
      }
    });
  });

  describe('rutas que dejan de existir', () => {
    it('GET /peliculas y GET /peliculas/1 responden 404 porque ya no existen', async () => {
      for (const ruta of ['/peliculas', '/peliculas/1']) {
        const res = await request(app.getHttpServer()).get(ruta).expect(404);

        expect(res.body.statusCode).toBe(404);
        expect(res.body.error).toBe('Not Found');
        expect(res.body.message).toMatch(/^Cannot GET \/peliculas/);
      }
    });
  });
});
