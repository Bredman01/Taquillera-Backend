import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';

// D8: aquí no se fuerza la zona. Las pruebas exigen el texto exacto de
// `inicio`, con «-05:00»: si el servidor lo convirtiera en un Date saldría en
// UTC, con «Z», y la prueba fallaría.

const MENSAJE_DEL_PIPE = 'Validation failed (numeric string is expected)';

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

describe('Funciones (e2e)', () => {
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

  describe('GET /funciones/:id', () => {
    it('GET /funciones/5 y GET /funciones/10 responden 200 con la función, los datos de su evento y exactamente sus siete campos', async () => {
      const cinco = await request(app.getHttpServer())
        .get('/funciones/5')
        .expect(200)
        .expect('Content-Type', /json/);

      expect(cinco.body).toEqual({
        id: 5,
        eventoId: 4,
        titulo: 'Cartas a Medianoche',
        ciudad: 'Neiva',
        lugar: 'Teatro Municipal de Neiva',
        inicio: '2026-11-21T16:00:00-05:00',
        precio: 25000,
      });
      expect(Object.keys(cinco.body).sort()).toEqual([
        'ciudad',
        'eventoId',
        'id',
        'inicio',
        'lugar',
        'precio',
        'titulo',
      ]);

      const diez = await request(app.getHttpServer())
        .get('/funciones/10')
        .expect(200)
        .expect('Content-Type', /json/);

      expect(diez.body).toEqual({
        id: 10,
        eventoId: 8,
        titulo: 'Del Grano a la Taza',
        ciudad: 'Neiva',
        lugar: 'Biblioteca Departamental',
        inicio: '2026-11-22T10:30:00-05:00',
        precio: 8000,
      });
      expect(Object.keys(diez.body).sort()).toEqual([
        'ciudad',
        'eventoId',
        'id',
        'inicio',
        'lugar',
        'precio',
        'titulo',
      ]);
    });

    it('GET /funciones/9999 responde 404 con «La función 9999 no existe»', async () => {
      const res = await request(app.getHttpServer())
        .get('/funciones/9999')
        .expect(404);

      expect(res.body).toEqual({
        statusCode: 404,
        message: 'La función 9999 no existe',
        error: 'Not Found',
      });
    });

    it('GET /funciones/0 y GET /funciones/-1 responden 404 con el mensaje de la función que no existe', async () => {
      for (const id of ['0', '-1']) {
        const res = await request(app.getHttpServer())
          .get(`/funciones/${id}`)
          .expect(404);

        expect(res.body).toEqual({
          statusCode: 404,
          message: `La función ${id} no existe`,
          error: 'Not Found',
        });
      }
    });

    it('GET /funciones/abc y GET /funciones/1.5 responden 400', async () => {
      for (const ruta of ['/funciones/abc', '/funciones/1.5']) {
        const res = await request(app.getHttpServer()).get(ruta).expect(400);

        expect(res.body).toEqual({
          statusCode: 400,
          message: MENSAJE_DEL_PIPE,
          error: 'Bad Request',
        });
      }
    });
  });

  describe('GET /funciones/:id/asientos', () => {
    it('GET /funciones/5/asientos responde 200 con los 40 asientos en orden, exactamente sus cuatro campos y los seis ocupados', async () => {
      const res = await request(app.getHttpServer())
        .get('/funciones/5/asientos')
        .expect(200)
        .expect('Content-Type', /json/);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(40);
      expect(res.body).toEqual(asientosEsperados(OCUPADOS_DE_LA_5));

      // La fila A tal como la muestra el contrato.
      expect(res.body.slice(0, 8)).toEqual([
        { id: 'A1', fila: 'A', numero: 1, estado: 'disponible' },
        { id: 'A2', fila: 'A', numero: 2, estado: 'disponible' },
        { id: 'A3', fila: 'A', numero: 3, estado: 'ocupado' },
        { id: 'A4', fila: 'A', numero: 4, estado: 'ocupado' },
        { id: 'A5', fila: 'A', numero: 5, estado: 'disponible' },
        { id: 'A6', fila: 'A', numero: 6, estado: 'disponible' },
        { id: 'A7', fila: 'A', numero: 7, estado: 'disponible' },
        { id: 'A8', fila: 'A', numero: 8, estado: 'disponible' },
      ]);

      for (const asiento of res.body) {
        expect(Object.keys(asiento).sort()).toEqual([
          'estado',
          'fila',
          'id',
          'numero',
        ]);
        expect(typeof asiento.numero).toBe('number');
      }

      const ocupados = res.body
        .filter((asiento: { estado: string }) => asiento.estado === 'ocupado')
        .map((asiento: { id: string }) => asiento.id);
      expect(ocupados).toEqual(OCUPADOS_DE_LA_5);
    });

    it('GET /funciones/10/asientos responde 200 con los 40 asientos disponibles', async () => {
      const res = await request(app.getHttpServer())
        .get('/funciones/10/asientos')
        .expect(200)
        .expect('Content-Type', /json/);

      expect(res.body).toHaveLength(40);
      expect(res.body).toEqual(asientosEsperados([]));
    });

    it('GET /funciones/9999/asientos responde 404 con «La función 9999 no existe»', async () => {
      const res = await request(app.getHttpServer())
        .get('/funciones/9999/asientos')
        .expect(404);

      expect(res.body).toEqual({
        statusCode: 404,
        message: 'La función 9999 no existe',
        error: 'Not Found',
      });
    });

    it('GET /funciones/0/asientos y GET /funciones/-1/asientos responden 404 con el mensaje de la función que no existe', async () => {
      for (const id of ['0', '-1']) {
        const res = await request(app.getHttpServer())
          .get(`/funciones/${id}/asientos`)
          .expect(404);

        expect(res.body).toEqual({
          statusCode: 404,
          message: `La función ${id} no existe`,
          error: 'Not Found',
        });
      }
    });

    it('GET /funciones/abc/asientos y GET /funciones/1.5/asientos responden 400', async () => {
      for (const ruta of [
        '/funciones/abc/asientos',
        '/funciones/1.5/asientos',
      ]) {
        const res = await request(app.getHttpServer()).get(ruta).expect(400);

        expect(res.body).toEqual({
          statusCode: 400,
          message: MENSAJE_DEL_PIPE,
          error: 'Bad Request',
        });
      }
    });
  });
});
