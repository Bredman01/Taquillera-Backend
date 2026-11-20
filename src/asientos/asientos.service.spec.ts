import { NotFoundException } from '@nestjs/common';
import { EventosService } from '../eventos/eventos.service.js';
import { FuncionesService } from '../funciones/funciones.service.js';
import { AsientosService } from './asientos.service.js';

// D8: aquí no se fuerza la zona. El servicio copia `inicio` tal cual y no hace
// ningún cálculo de hora; las pruebas exigen el texto exacto con «-05:00».

// El plano del lugar, escrito a mano (D4, D5): cinco filas de ocho asientos,
// siempre en este orden. No se arma con FILAS ni con ASIENTOS_POR_FILA para que
// un error en el plano no se repita en la prueba.
const IDS_EN_ORDEN = [
  ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8'],
  ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8'],
  ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8'],
  ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8'],
  ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8'],
].flat();

// Los únicos ocupados de los datos de ejemplo (D6): los de la función 5.
const OCUPADOS_DE_LA_5 = ['A3', 'A4', 'C1', 'C8', 'D5', 'E8'];

// Las otras nueve funciones de ejemplo.
const SIN_OCUPADOS = [1, 2, 3, 4, 6, 7, 8, 9, 10];

const asientosEsperados = (ocupados: string[]) =>
  IDS_EN_ORDEN.map((id) => ({
    id,
    fila: id.slice(0, 1),
    numero: Number(id.slice(1)),
    estado: ocupados.includes(id) ? 'ocupado' : 'disponible',
  }));

const ASIENTOS_DE_LA_5 = asientosEsperados(OCUPADOS_DE_LA_5);
const ASIENTOS_LIBRES = asientosEsperados([]);

const CAMPOS_DE_LA_FUNCION = [
  'ciudad',
  'eventoId',
  'id',
  'inicio',
  'lugar',
  'precio',
  'titulo',
];

describe('AsientosService', () => {
  let funciones: FuncionesService;
  let eventos: EventosService;
  let service: AsientosService;

  beforeEach(() => {
    funciones = new FuncionesService();
    eventos = new EventosService(funciones);
    service = new AsientosService(funciones, eventos);
  });

  it('findFuncion devuelve la función con el título, la ciudad y el lugar de su evento, y exactamente siete campos', () => {
    expect(service.findFuncion(5)).toEqual({
      id: 5,
      eventoId: 4,
      titulo: 'Cartas a Medianoche',
      ciudad: 'Neiva',
      lugar: 'Teatro Municipal de Neiva',
      inicio: '2026-11-21T16:00:00-05:00',
      precio: 25000,
    });
    expect(service.findFuncion(10)).toEqual({
      id: 10,
      eventoId: 8,
      titulo: 'Del Grano a la Taza',
      ciudad: 'Neiva',
      lugar: 'Biblioteca Departamental',
      inicio: '2026-11-22T10:30:00-05:00',
      precio: 8000,
    });
    expect(service.findFuncion(1)).toEqual({
      id: 1,
      eventoId: 1,
      titulo: 'El Último Faro',
      ciudad: 'Neiva',
      lugar: 'Cine Club La Gaitana',
      inicio: '2026-11-21T18:00:00-05:00',
      precio: 15000,
    });

    // Las diez, con exactamente los siete campos del contrato.
    for (let id = 1; id <= 10; id += 1) {
      const campos = Object.keys(service.findFuncion(id)).sort();
      expect(campos, `función ${id}`).toEqual(CAMPOS_DE_LA_FUNCION);
    }
  });

  it('findFuncion lanza NotFoundException con «La función 9999 no existe», también con 0 y -1', () => {
    for (const id of [9999, 0, -1]) {
      expect(() => service.findFuncion(id)).toThrow(NotFoundException);
      expect(() => service.findFuncion(id)).toThrow(
        new RegExp(`^La función ${id} no existe$`),
      );
    }
  });

  it('findAsientos devuelve los 40 asientos ordenados por fila y por número, con exactamente id, fila, numero y estado', () => {
    for (let funcionId = 1; funcionId <= 10; funcionId += 1) {
      const asientos = service.findAsientos(funcionId);

      expect(asientos, `función ${funcionId}`).toHaveLength(40);
      expect(
        asientos.map((asiento) => asiento.id),
        `función ${funcionId}`,
      ).toEqual(IDS_EN_ORDEN);

      for (const asiento of asientos) {
        expect(Object.keys(asiento).sort()).toEqual([
          'estado',
          'fila',
          'id',
          'numero',
        ]);
        expect(typeof asiento.id).toBe('string');
        expect(['A', 'B', 'C', 'D', 'E']).toContain(asiento.fila);
        expect(Number.isInteger(asiento.numero)).toBe(true);
        expect(asiento.numero).toBeGreaterThanOrEqual(1);
        expect(asiento.numero).toBeLessThanOrEqual(8);
        expect(asiento.id).toBe(`${asiento.fila}${asiento.numero}`);
        expect(['disponible', 'ocupado']).toContain(asiento.estado);
      }
    }
  });

  it('findAsientos marca como ocupados los seis asientos de ejemplo de la función 5 y el resto como disponibles', () => {
    const asientos = service.findAsientos(5);

    expect(
      asientos
        .filter((asiento) => asiento.estado === 'ocupado')
        .map((asiento) => asiento.id),
    ).toEqual(OCUPADOS_DE_LA_5);
    expect(
      asientos.filter((asiento) => asiento.estado === 'disponible'),
    ).toHaveLength(34);

    // `estado` solo toma esos dos valores, en minúsculas.
    const estados = new Set<string>(asientos.map((asiento) => asiento.estado));
    expect([...estados].sort()).toEqual(['disponible', 'ocupado']);

    // La lista completa, objeto por objeto.
    expect(asientos).toEqual(ASIENTOS_DE_LA_5);
    expect(asientos[2]).toEqual({
      id: 'A3',
      fila: 'A',
      numero: 3,
      estado: 'ocupado',
    });
    expect(asientos[39]).toEqual({
      id: 'E8',
      fila: 'E',
      numero: 8,
      estado: 'ocupado',
    });
    expect(asientos[0]).toEqual({
      id: 'A1',
      fila: 'A',
      numero: 1,
      estado: 'disponible',
    });
  });

  it('findAsientos lanza NotFoundException con «La función 9999 no existe», también con 0 y -1', () => {
    for (const id of [9999, 0, -1]) {
      expect(() => service.findAsientos(id)).toThrow(NotFoundException);
      expect(() => service.findAsientos(id)).toThrow(
        new RegExp(`^La función ${id} no existe$`),
      );
    }
  });

  it('los ocupados son de cada función: las otras nueve, incluidas la 3 y la 4 del mismo evento, tienen sus 40 asientos disponibles', () => {
    // La 5 se consulta primero: lo que ocupa no debe pasar a las otras.
    expect(
      service
        .findAsientos(5)
        .filter((asiento) => asiento.estado === 'ocupado'),
    ).toHaveLength(6);

    for (const funcionId of SIN_OCUPADOS) {
      const asientos = service.findAsientos(funcionId);
      expect(asientos, `función ${funcionId}`).toEqual(ASIENTOS_LIBRES);
      expect(
        asientos.filter((asiento) => asiento.estado === 'ocupado'),
        `función ${funcionId}`,
      ).toEqual([]);
    }

    // La 3 y la 4 son del mismo evento que la 5 (el 4).
    expect(service.findFuncion(3).eventoId).toBe(4);
    expect(service.findFuncion(4).eventoId).toBe(4);
    expect(service.findFuncion(5).eventoId).toBe(4);
  });

  it('cada función de ejemplo pertenece a un evento que existe', () => {
    for (let id = 1; id <= 10; id += 1) {
      expect(() => service.findFuncion(id), `función ${id}`).not.toThrow();

      const funcion = service.findFuncion(id);
      const evento = eventos.findOne(funcion.eventoId);
      expect(funcion, `función ${id}`).toEqual({
        ...funciones.findOne(id),
        titulo: evento.titulo,
        ciudad: evento.ciudad,
        lugar: evento.lugar,
      });
    }
  });

  it('modificar el resultado de findAsientos o de findFuncion no altera los datos internos', () => {
    const asientos = service.findAsientos(5);
    asientos[0].estado = 'ocupado'; // A1 estaba disponible
    asientos[2].estado = 'disponible'; // A3 estaba ocupado
    asientos[1].id = 'Z9';
    asientos.pop();
    asientos.length = 0;

    expect(service.findAsientos(5)).toEqual(ASIENTOS_DE_LA_5);
    expect(service.findAsientos(10)).toEqual(ASIENTOS_LIBRES);
    // Cada llamada arma objetos nuevos.
    expect(service.findAsientos(5)[0]).not.toBe(service.findAsientos(5)[0]);
    expect(service.findAsientos(5)).not.toBe(service.findAsientos(5));

    const funcion = service.findFuncion(5);
    funcion.titulo = 'Modificado';
    funcion.ciudad = 'Modificada';
    funcion.lugar = 'Modificado';
    funcion.inicio = '2000-01-01T00:00:00-05:00';
    funcion.precio = 1;
    funcion.eventoId = 99;

    expect(service.findFuncion(5)).toEqual({
      id: 5,
      eventoId: 4,
      titulo: 'Cartas a Medianoche',
      ciudad: 'Neiva',
      lugar: 'Teatro Municipal de Neiva',
      inicio: '2026-11-21T16:00:00-05:00',
      precio: 25000,
    });
    expect(service.findFuncion(5)).not.toBe(service.findFuncion(5));
    // Ni la función ni el evento de los servicios reales cambiaron.
    expect(funciones.findOne(5)).toEqual({
      id: 5,
      eventoId: 4,
      inicio: '2026-11-21T16:00:00-05:00',
      precio: 25000,
    });
    expect(eventos.findOne(4).titulo).toBe('Cartas a Medianoche');
  });
});
