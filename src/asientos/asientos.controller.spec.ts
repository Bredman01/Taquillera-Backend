import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AsientosController } from './asientos.controller.js';
import { AsientosService } from './asientos.service.js';

const funcionDePrueba = {
  id: 5,
  eventoId: 4,
  titulo: 'Cartas a Medianoche',
  ciudad: 'Neiva',
  lugar: 'Teatro Municipal de Neiva',
  inicio: '2026-11-21T16:00:00-05:00',
  precio: 25000,
};

const asientosDePrueba = [
  { id: 'A1', fila: 'A', numero: 1, estado: 'disponible' },
  { id: 'A2', fila: 'A', numero: 2, estado: 'disponible' },
  { id: 'A3', fila: 'A', numero: 3, estado: 'ocupado' },
];

describe('AsientosController', () => {
  let controller: AsientosController;
  const service = {
    findFuncion: vi.fn(),
    findAsientos: vi.fn(),
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [AsientosController],
      providers: [{ provide: AsientosService, useValue: service }],
    }).compile();

    controller = moduleRef.get(AsientosController);
  });

  it('findFuncion llama al servicio con el id y devuelve su resultado', () => {
    service.findFuncion.mockReturnValue(funcionDePrueba);

    expect(controller.findFuncion(5)).toEqual(funcionDePrueba);
    expect(service.findFuncion).toHaveBeenCalledTimes(1);
    expect(service.findFuncion).toHaveBeenCalledWith(5);

    // Con otro id, el servicio recibe ese otro id.
    controller.findFuncion(10);
    expect(service.findFuncion).toHaveBeenLastCalledWith(10);

    // La ruta de la función no pide los asientos.
    expect(service.findAsientos).not.toHaveBeenCalled();
  });

  it('findFuncion propaga la NotFoundException del servicio', () => {
    service.findFuncion.mockImplementation(() => {
      throw new NotFoundException('La función 9999 no existe');
    });

    expect(() => controller.findFuncion(9999)).toThrow(NotFoundException);
    expect(() => controller.findFuncion(9999)).toThrow(
      /^La función 9999 no existe$/,
    );
    expect(service.findFuncion).toHaveBeenCalledWith(9999);
  });

  it('findAsientos llama al servicio con el id y devuelve su resultado', () => {
    service.findAsientos.mockReturnValue(asientosDePrueba);

    expect(controller.findAsientos(5)).toEqual(asientosDePrueba);
    expect(service.findAsientos).toHaveBeenCalledTimes(1);
    expect(service.findAsientos).toHaveBeenCalledWith(5);

    // Con otro id, el servicio recibe ese otro id.
    controller.findAsientos(10);
    expect(service.findAsientos).toHaveBeenLastCalledWith(10);

    // La ruta de los asientos no pide la función.
    expect(service.findFuncion).not.toHaveBeenCalled();
  });

  it('findAsientos propaga la NotFoundException del servicio', () => {
    service.findAsientos.mockImplementation(() => {
      throw new NotFoundException('La función 9999 no existe');
    });

    expect(() => controller.findAsientos(9999)).toThrow(NotFoundException);
    expect(() => controller.findAsientos(9999)).toThrow(
      /^La función 9999 no existe$/,
    );
    expect(service.findAsientos).toHaveBeenCalledWith(9999);
  });
});
