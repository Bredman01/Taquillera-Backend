import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { BoletasController } from './boletas.controller.js';
import { BoletasService } from './boletas.service.js';

const boletaValida = {
  codigo: 'K7Q2M9XA',
  titulo: 'El Último Faro',
  inicio: '2026-11-22T15:00:00-05:00',
  lugar: 'Cine Club La Gaitana',
  ciudad: 'Neiva',
  asientos: ['D1', 'D2'],
  nombre: 'Ana Pérez',
  estado: 'valida',
  fechaUso: null,
};

const boletaUsada = {
  ...boletaValida,
  estado: 'usada',
  fechaUso: '2026-11-22T14:45:12-05:00',
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

describe('BoletasController', () => {
  let controller: BoletasController;
  const service = {
    findByCodigo: vi.fn(),
    validar: vi.fn(),
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [BoletasController],
      providers: [{ provide: BoletasService, useValue: service }],
    }).compile();

    controller = moduleRef.get(BoletasController);
  });

  // Sin criterio: el controlador solo traduce HTTP a servicio. El código se
  // pasa a mayúsculas en el servicio, no aquí.
  it('findOne y validar pasan el código al servicio y devuelven su boleta', () => {
    // findOne lee: llama a findByCodigo y no marca nada.
    service.findByCodigo.mockReturnValue(boletaValida);

    expect(controller.findOne('K7Q2M9XA')).toBe(boletaValida);
    expect(service.findByCodigo).toHaveBeenCalledTimes(1);
    expect(service.findByCodigo).toHaveBeenCalledWith('K7Q2M9XA');
    expect(service.validar).not.toHaveBeenCalled();

    // El código llega al servicio tal como lo escribió quien llama.
    controller.findOne('k7q2m9xa');
    expect(service.findByCodigo).toHaveBeenCalledTimes(2);
    expect(service.findByCodigo).toHaveBeenLastCalledWith('k7q2m9xa');

    // validar marca: llama a validar y no a la lectura.
    service.findByCodigo.mockReset();
    service.validar.mockReturnValue(boletaUsada);

    expect(controller.validar('K7Q2M9XA')).toBe(boletaUsada);
    expect(service.validar).toHaveBeenCalledTimes(1);
    expect(service.validar).toHaveBeenCalledWith('K7Q2M9XA');
    expect(service.findByCodigo).not.toHaveBeenCalled();

    controller.validar('p3r8t5zb');
    expect(service.validar).toHaveBeenCalledTimes(2);
    expect(service.validar).toHaveBeenLastCalledWith('p3r8t5zb');
  });

  it('propaga las excepciones del servicio', () => {
    const noExiste = new NotFoundException({
      statusCode: 404,
      message: 'La boleta ZZZZ9999 no existe',
      error: 'Not Found',
    });
    const yaUsada = new ConflictException({
      statusCode: 409,
      message: 'La boleta K7Q2M9XA ya fue usada',
      error: 'Conflict',
      fechaUso: '2026-11-22T14:45:12-05:00',
    });

    // GET: el 404 llega tal cual.
    service.findByCodigo.mockImplementation(() => {
      throw noExiste;
    });
    expect(lanzado(() => controller.findOne('ZZZZ9999'))).toBe(noExiste);
    expect(service.findByCodigo).toHaveBeenCalledWith('ZZZZ9999');

    // POST: el 404 y el 409 llegan tal cual, sin envolver ni cambiar.
    for (const excepcion of [noExiste, yaUsada]) {
      service.validar.mockReset();
      service.validar.mockImplementation(() => {
        throw excepcion;
      });

      expect(lanzado(() => controller.validar('K7Q2M9XA'))).toBe(excepcion);
      expect(service.validar).toHaveBeenCalledWith('K7Q2M9XA');
    }
  });
});
