import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PeliculasController } from './peliculas.controller.js';
import { PeliculasService } from './peliculas.service.js';
import { Pelicula } from './entities/pelicula.entity.js';

const peliculaDePrueba: Pelicula = {
  id: 2,
  titulo: 'Galaxia Perdida',
  sinopsis: 'Sinopsis de prueba.',
  duracionMinutos: 132,
  clasificacion: '+7',
  genero: 'Ciencia ficción',
  imagenUrl: 'https://placehold.co/400x600/png?text=Galaxia+Perdida',
};

describe('PeliculasController', () => {
  let controller: PeliculasController;
  const service = {
    findAll: vi.fn(),
    findOne: vi.fn(),
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [PeliculasController],
      providers: [{ provide: PeliculasService, useValue: service }],
    }).compile();

    controller = moduleRef.get(PeliculasController);
  });

  it('findAll delega en el servicio y devuelve su resultado', () => {
    service.findAll.mockReturnValue([peliculaDePrueba]);
    expect(controller.findAll()).toEqual([peliculaDePrueba]);
    expect(service.findAll).toHaveBeenCalledTimes(1);
  });

  it('findOne llama al servicio con el id y devuelve su resultado', () => {
    service.findOne.mockReturnValue(peliculaDePrueba);
    expect(controller.findOne(2)).toEqual(peliculaDePrueba);
    expect(service.findOne).toHaveBeenCalledWith(2);
  });

  it('findOne propaga la NotFoundException del servicio', () => {
    service.findOne.mockImplementation(() => {
      throw new NotFoundException('La película 9999 no existe');
    });
    expect(() => controller.findOne(9999)).toThrow(NotFoundException);
  });
});
