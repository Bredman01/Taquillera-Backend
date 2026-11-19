import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { EventosController } from './eventos.controller.js';
import { EventosService } from './eventos.service.js';
import type { Evento } from './entities/evento.entity.js';

const eventoDePrueba: Evento = {
  id: 4,
  titulo: 'Cartas a Medianoche',
  descripcion: 'Descripción de prueba.',
  categoria: 'teatro',
  ciudad: 'Neiva',
  lugar: 'Teatro Municipal de Neiva',
  duracionMinutos: 90,
  clasificacion: '+13',
  imagenUrl: 'https://placehold.co/400x600/png?text=Cartas+a+Medianoche',
};

describe('EventosController', () => {
  let controller: EventosController;
  const service = {
    findAll: vi.fn(),
    findOne: vi.fn(),
    findCiudades: vi.fn(),
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [EventosController],
      providers: [{ provide: EventosService, useValue: service }],
    }).compile();

    controller = moduleRef.get(EventosController);
  });

  it('findAll delega en el servicio y devuelve su resultado', () => {
    service.findAll.mockReturnValue([eventoDePrueba]);
    expect(controller.findAll(undefined, undefined)).toEqual([eventoDePrueba]);
    expect(service.findAll).toHaveBeenCalledTimes(1);
  });

  it('findAll pasa la categoría y la ciudad de la consulta al servicio', () => {
    service.findAll.mockReturnValue([eventoDePrueba]);

    expect(controller.findAll('teatro', 'Neiva')).toEqual([eventoDePrueba]);
    expect(service.findAll).toHaveBeenLastCalledWith({
      categoria: 'teatro',
      ciudad: 'Neiva',
    });

    // Cada parámetro llega a su propio filtro, sin cruzarse.
    controller.findAll('charla', undefined);
    expect(service.findAll).toHaveBeenLastCalledWith({
      categoria: 'charla',
      ciudad: undefined,
    });
    controller.findAll(undefined, 'Bogotá');
    expect(service.findAll).toHaveBeenLastCalledWith({
      categoria: undefined,
      ciudad: 'Bogotá',
    });

    // Un parámetro repetido llega como arreglo y el servicio decide qué hacer.
    controller.findAll(['teatro', 'cine'], ['Neiva', 'Bogotá']);
    expect(service.findAll).toHaveBeenLastCalledWith({
      categoria: ['teatro', 'cine'],
      ciudad: ['Neiva', 'Bogotá'],
    });
    expect(service.findAll).toHaveBeenCalledTimes(4);
  });

  it('findCiudades delega en el servicio y devuelve su resultado', () => {
    service.findCiudades.mockReturnValue(['Bogotá', 'Neiva']);
    expect(controller.findCiudades()).toEqual(['Bogotá', 'Neiva']);
    expect(service.findCiudades).toHaveBeenCalledTimes(1);
  });

  it('findOne llama al servicio con el id y devuelve su resultado', () => {
    service.findOne.mockReturnValue(eventoDePrueba);
    expect(controller.findOne(4)).toEqual(eventoDePrueba);
    expect(service.findOne).toHaveBeenCalledWith(4);
  });

  it('findOne propaga la NotFoundException del servicio', () => {
    service.findOne.mockImplementation(() => {
      throw new NotFoundException('El evento 9999 no existe');
    });
    expect(() => controller.findOne(9999)).toThrow(NotFoundException);
  });
});
