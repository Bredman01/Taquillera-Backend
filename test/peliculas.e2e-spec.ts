import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';

describe('Peliculas (e2e)', () => {
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

  it('GET /peliculas responde 200 con las 6 películas', async () => {
    const res = await request(app.getHttpServer())
      .get('/peliculas')
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(6);
    expect(Object.keys(res.body[0]).sort()).toEqual(
      [
        'clasificacion',
        'duracionMinutos',
        'genero',
        'id',
        'imagenUrl',
        'sinopsis',
        'titulo',
      ].sort(),
    );
  });

  it('GET /peliculas/1 responde 200 con la película', async () => {
    const res = await request(app.getHttpServer())
      .get('/peliculas/1')
      .expect(200);

    expect(res.body.id).toBe(1);
    expect(res.body.titulo).toBe('El Último Faro');
  });

  it('GET /peliculas/9999 responde 404', async () => {
    const res = await request(app.getHttpServer())
      .get('/peliculas/9999')
      .expect(404);

    expect(res.body.message).toBe('La película 9999 no existe');
  });

  it('GET /peliculas/abc responde 400', () => {
    return request(app.getHttpServer()).get('/peliculas/abc').expect(400);
  });

  it('GET /peliculas/1.5 responde 400', () => {
    return request(app.getHttpServer()).get('/peliculas/1.5').expect(400);
  });
});
