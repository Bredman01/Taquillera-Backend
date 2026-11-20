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

describe('Eventos (e2e)', () => {
  let app: INestApplication<App>;

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
