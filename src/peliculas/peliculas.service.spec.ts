import { NotFoundException } from '@nestjs/common';
import { PeliculasService } from './peliculas.service.js';
import { CLASIFICACIONES } from './entities/pelicula.entity.js';

describe('PeliculasService', () => {
  let service: PeliculasService;

  beforeEach(() => {
    service = new PeliculasService();
  });

  describe('findAll', () => {
    it('devuelve las 6 películas de la cartelera', () => {
      expect(service.findAll()).toHaveLength(6);
    });

    it('cada película tiene todos los campos con el tipo correcto', () => {
      for (const pelicula of service.findAll()) {
        expect(typeof pelicula.id).toBe('number');
        expect(typeof pelicula.titulo).toBe('string');
        expect(typeof pelicula.sinopsis).toBe('string');
        expect(typeof pelicula.duracionMinutos).toBe('number');
        expect(pelicula.duracionMinutos).toBeGreaterThan(0);
        expect(CLASIFICACIONES).toContain(pelicula.clasificacion);
        expect(typeof pelicula.genero).toBe('string');
        expect(pelicula.imagenUrl).toMatch(/^https:\/\//);
      }
    });

    it('los ids son únicos', () => {
      const ids = service.findAll().map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('modificar el resultado no altera los datos internos', () => {
      const lista = service.findAll();
      lista[0].titulo = 'Modificado';
      lista.pop();
      expect(service.findAll()).toHaveLength(6);
      expect(service.findAll()[0].titulo).toBe('El Último Faro');
    });
  });

  describe('findOne', () => {
    it('devuelve la película con el id pedido', () => {
      const pelicula = service.findOne(1);
      expect(pelicula.id).toBe(1);
      expect(pelicula.titulo).toBe('El Último Faro');
    });

    it('modificar el resultado no altera los datos internos', () => {
      service.findOne(1).titulo = 'Modificado';
      expect(service.findOne(1).titulo).toBe('El Último Faro');
    });

    it('lanza NotFoundException si el id no existe', () => {
      expect(() => service.findOne(9999)).toThrow(NotFoundException);
      expect(() => service.findOne(9999)).toThrow('La película 9999 no existe');
    });
  });
});
