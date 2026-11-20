import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ComprasController } from './compras.controller.js';
import { ComprasService } from './compras.service.js';

const compraDePrueba = {
  codigo: 'K7Q2M9XA',
  funcionId: 1,
  asientos: ['A1', 'A2'],
  total: 30000,
  fecha: '2026-11-19T15:04:05-05:00',
};

const pedidoDePrueba = {
  asientos: ['A1', 'A2'],
  nombre: 'Ana Pérez',
  correo: 'ana@correo.co',
};

// Ejecuta la acción y devuelve lo que lanzó. Si no lanza nada, la prueba falla.
function lanzado(accion: () => unknown): unknown {
  try {
    accion();
  } catch (error) {
    return error;
  }
  throw new Error('Se esperaba una excepción y no se lanzó ninguna');
}

describe('ComprasController', () => {
  let controller: ComprasController;
  const service = {
    crear: vi.fn(),
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [ComprasController],
      providers: [{ provide: ComprasService, useValue: service }],
    }).compile();

    controller = moduleRef.get(ComprasController);
  });

  it('crear pasa el id y el cuerpo al servicio y devuelve su resultado', () => {
    service.crear.mockReturnValue(compraDePrueba);

    expect(controller.crear(1, pedidoDePrueba)).toEqual(compraDePrueba);
    expect(service.crear).toHaveBeenCalledTimes(1);
    expect(service.crear).toHaveBeenCalledWith(1, pedidoDePrueba);

    // Con otro id y otro cuerpo, el servicio recibe esos.
    const otroPedido = { asientos: ['B1'], nombre: 'Luis', correo: 'l@x.co' };
    controller.crear(10, otroPedido);
    expect(service.crear).toHaveBeenCalledTimes(2);
    expect(service.crear).toHaveBeenLastCalledWith(10, otroPedido);

    // El controlador no valida ni cambia el cuerpo: el servicio recibe lo que
    // llegó, incluido un cuerpo que no es un objeto.
    controller.crear(2, undefined);
    expect(service.crear).toHaveBeenLastCalledWith(2, undefined);
    controller.crear(3, 'texto');
    expect(service.crear).toHaveBeenLastCalledWith(3, 'texto');
  });

  it('propaga las excepciones del servicio', () => {
    const excepciones = [
      new NotFoundException('La función 9999 no existe'),
      new BadRequestException('Elige al menos un asiento'),
      new ConflictException({
        statusCode: 409,
        message: 'Estos asientos ya no están disponibles: A3, C1',
        error: 'Conflict',
        asientos: ['A3', 'C1'],
      }),
    ];

    for (const excepcion of excepciones) {
      service.crear.mockReset();
      service.crear.mockImplementation(() => {
        throw excepcion;
      });

      // Es la misma excepción, sin envolver ni cambiar.
      expect(lanzado(() => controller.crear(9999, pedidoDePrueba))).toBe(
        excepcion,
      );
      expect(service.crear).toHaveBeenCalledWith(9999, pedidoDePrueba);
    }
  });
});
