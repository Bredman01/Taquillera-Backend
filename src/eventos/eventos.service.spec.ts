import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EventosService } from './eventos.service.js';
import { CATEGORIAS, CLASIFICACIONES } from './entities/evento.entity.js';
import type { Evento } from './entities/evento.entity.js';

// Los diez eventos de ejemplo aprobados en el plan (D7), sin descripción ni imagen.
const EVENTOS_DE_EJEMPLO = [
  {
    id: 1,
    titulo: 'El Último Faro',
    categoria: 'cine',
    ciudad: 'Neiva',
    lugar: 'Cine Club La Gaitana',
    duracionMinutos: 118,
    clasificacion: '+13',
  },
  {
    id: 2,
    titulo: 'Galaxia Perdida',
    categoria: 'cine',
    ciudad: 'Bogotá',
    lugar: 'Cinemateca Central',
    duracionMinutos: 132,
    clasificacion: '+7',
  },
  {
    id: 3,
    titulo: 'Risas en Familia',
    categoria: 'cine',
    ciudad: 'Pitalito',
    lugar: 'Casa de la Cultura de Pitalito',
    duracionMinutos: 95,
    clasificacion: 'TP',
  },
  {
    id: 4,
    titulo: 'Cartas a Medianoche',
    categoria: 'teatro',
    ciudad: 'Neiva',
    lugar: 'Teatro Municipal de Neiva',
    duracionMinutos: 90,
    clasificacion: '+13',
  },
  {
    id: 5,
    titulo: 'El Inspector Distraído',
    categoria: 'teatro',
    ciudad: 'Bogotá',
    lugar: 'Teatro del Parque',
    duracionMinutos: 80,
    clasificacion: 'TP',
  },
  {
    id: 6,
    titulo: 'Bambucos al Atardecer',
    categoria: 'concierto',
    ciudad: 'Neiva',
    lugar: 'Concha Acústica del Malecón',
    duracionMinutos: 120,
    clasificacion: 'TP',
  },
  {
    id: 7,
    titulo: 'Rock del Valle de Laboyos',
    categoria: 'concierto',
    ciudad: 'Pitalito',
    lugar: 'Coliseo Cubierto de Pitalito',
    duracionMinutos: 150,
    clasificacion: '+16',
  },
  {
    id: 8,
    titulo: 'Del Grano a la Taza',
    categoria: 'charla',
    ciudad: 'Neiva',
    lugar: 'Biblioteca Departamental',
    duracionMinutos: 60,
    clasificacion: 'TP',
  },
  {
    id: 9,
    titulo: 'Inteligencia Artificial sin Miedo',
    categoria: 'charla',
    ciudad: 'Bogotá',
    lugar: 'Auditorio Central',
    duracionMinutos: 75,
    clasificacion: 'TP',
  },
  {
    id: 10,
    titulo: 'Historia del Huila en Cinco Objetos',
    categoria: 'charla',
    ciudad: 'Íquira',
    lugar: 'Casa de la Cultura de Íquira',
    duracionMinutos: 50,
    clasificacion: 'TP',
  },
];

// Los eventos 1 a 3 conservan el texto que ya tenían (D7).
const DESCRIPCIONES_CONSERVADAS: Record<number, string> = {
  1: 'Un farero solitario descubre un mensaje que cambia la historia de su pueblo.',
  2: 'La tripulación de una nave de carga queda varada en un sistema que no aparece en ningún mapa.',
  3: 'Tres generaciones comparten una casa durante las vacaciones y nada sale como lo planearon.',
};

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

const ids = (eventos: Evento[]): number[] => eventos.map((e) => e.id);

const sinTildes = (texto: string): string =>
  texto.normalize('NFD').replace(/\p{M}/gu, '');

const resumen = (evento: Evento) => ({
  id: evento.id,
  titulo: evento.titulo,
  categoria: evento.categoria,
  ciudad: evento.ciudad,
  lugar: evento.lugar,
  duracionMinutos: evento.duracionMinutos,
  clasificacion: evento.clasificacion,
});

describe('EventosService', () => {
  let service: EventosService;

  beforeEach(() => {
    service = new EventosService();
  });

  describe('findAll', () => {
    it('devuelve los 10 eventos de la cartelera en orden de id', () => {
      const eventos = service.findAll({});
      expect(eventos).toHaveLength(10);
      expect(ids(eventos)).toEqual(TODOS);
    });

    it('sin filtros devuelve los 10 eventos con todos sus campos y una categoría válida', () => {
      const eventos = service.findAll({});
      expect(eventos).toHaveLength(10);
      expect(CATEGORIAS).toEqual(['cine', 'teatro', 'concierto', 'charla']);

      for (const evento of eventos) {
        expect(Object.keys(evento).sort()).toEqual(CAMPOS_DEL_EVENTO);
        expect(Number.isInteger(evento.id)).toBe(true);
        expect(evento.id).toBeGreaterThanOrEqual(1);
        expect(typeof evento.titulo).toBe('string');
        expect(typeof evento.descripcion).toBe('string');
        expect(evento.descripcion.trim().length).toBeGreaterThan(0);
        expect(CATEGORIAS).toContain(evento.categoria);
        expect(typeof evento.ciudad).toBe('string');
        expect(typeof evento.lugar).toBe('string');
        expect(Number.isInteger(evento.duracionMinutos)).toBe(true);
        expect(evento.duracionMinutos).toBeGreaterThan(0);
        expect(CLASIFICACIONES).toContain(evento.clasificacion);

        // El afiche es de placehold.co y su texto es el título (con o sin tildes).
        const afiche = new URL(evento.imagenUrl);
        expect(afiche.origin).toBe('https://placehold.co');
        expect(sinTildes(afiche.searchParams.get('text') ?? '')).toBe(
          sinTildes(evento.titulo),
        );
      }

      // Valores concretos de los datos de ejemplo.
      expect(eventos.map(resumen)).toEqual(EVENTOS_DE_EJEMPLO);
      for (const [id, descripcion] of Object.entries(
        DESCRIPCIONES_CONSERVADAS,
      )) {
        expect(eventos[Number(id) - 1].descripcion).toBe(descripcion);
      }
    });

    it('los ids son únicos', () => {
      const todos = ids(service.findAll({}));
      expect(new Set(todos).size).toBe(todos.length);
    });

    it('modificar el resultado no altera los datos internos', () => {
      const lista = service.findAll({});
      lista[0].titulo = 'Modificado';
      lista.pop();
      expect(service.findAll({})).toHaveLength(10);
      expect(service.findAll({})[0].titulo).toBe('El Último Faro');

      // También el resultado de una consulta filtrada es una copia.
      const filtrada = service.findAll({ categoria: 'teatro' });
      filtrada[0].titulo = 'Modificado';
      expect(service.findOne(4).titulo).toBe('Cartas a Medianoche');
    });

    it('filtra por categoría', () => {
      expect(ids(service.findAll({ categoria: 'cine' }))).toEqual([1, 2, 3]);
      expect(ids(service.findAll({ categoria: 'teatro' }))).toEqual([4, 5]);
      expect(ids(service.findAll({ categoria: 'concierto' }))).toEqual([6, 7]);
      expect(ids(service.findAll({ categoria: 'charla' }))).toEqual([
        8, 9, 10,
      ]);
    });

    it('filtra por ciudad', () => {
      expect(ids(service.findAll({ ciudad: 'Neiva' }))).toEqual([1, 4, 6, 8]);
      expect(ids(service.findAll({ ciudad: 'Bogotá' }))).toEqual([2, 5, 9]);
      expect(ids(service.findAll({ ciudad: 'Pitalito' }))).toEqual([3, 7]);
      expect(ids(service.findAll({ ciudad: 'Íquira' }))).toEqual([10]);
    });

    it('filtra por categoría y ciudad a la vez', () => {
      expect(
        ids(service.findAll({ categoria: 'teatro', ciudad: 'Neiva' })),
      ).toEqual([4]);
      expect(
        ids(service.findAll({ categoria: 'charla', ciudad: 'Pitalito' })),
      ).toEqual([]);
    });

    it('compara la ciudad sin distinguir mayúsculas, tildes ni espacios', () => {
      expect(ids(service.findAll({ ciudad: 'bogota' }))).toEqual([2, 5, 9]);
      expect(ids(service.findAll({ ciudad: 'BOGOTÁ' }))).toEqual([2, 5, 9]);
      expect(ids(service.findAll({ ciudad: '  bogotá  ' }))).toEqual([2, 5, 9]);
      expect(ids(service.findAll({ ciudad: 'NEIVA' }))).toEqual([1, 4, 6, 8]);
      expect(ids(service.findAll({ ciudad: ' Neiva ' }))).toEqual([1, 4, 6, 8]);
      expect(ids(service.findAll({ ciudad: 'Neivá' }))).toEqual([1, 4, 6, 8]);
      expect(ids(service.findAll({ ciudad: 'iquira' }))).toEqual([10]);
      expect(ids(service.findAll({ ciudad: 'ÍQUIRA' }))).toEqual([10]);
      // Es una comparación completa, no una búsqueda de fragmentos.
      expect(ids(service.findAll({ ciudad: 'Nei' }))).toEqual([]);
    });

    it('rechaza una categoría que no es una de las cuatro', () => {
      expect(() => service.findAll({ categoria: 'magia' })).toThrow(
        BadRequestException,
      );
      expect(() => service.findAll({ categoria: 'magia' })).toThrow(
        /^La categoría magia no existe$/,
      );
      // La categoría se escribe exactamente en minúsculas.
      expect(() => service.findAll({ categoria: 'Teatro' })).toThrow(
        BadRequestException,
      );
      expect(() => service.findAll({ categoria: 'Teatro' })).toThrow(
        /^La categoría Teatro no existe$/,
      );
      // Se valida aunque la ciudad no tenga eventos.
      expect(() =>
        service.findAll({ categoria: 'magia', ciudad: 'Medellín' }),
      ).toThrow(BadRequestException);
    });

    it('devuelve una lista vacía si la ciudad no tiene eventos', () => {
      expect(service.findAll({ ciudad: 'Medellín' })).toEqual([]);
      expect(
        service.findAll({ categoria: 'teatro', ciudad: 'Medellín' }),
      ).toEqual([]);
    });

    it('trata una categoría o una ciudad vacía como sin filtro', () => {
      expect(ids(service.findAll({ categoria: '', ciudad: '' }))).toEqual(
        TODOS,
      );
      expect(
        ids(service.findAll({ categoria: undefined, ciudad: undefined })),
      ).toEqual(TODOS);
      expect(ids(service.findAll({ categoria: '', ciudad: 'Neiva' }))).toEqual([
        1, 4, 6, 8,
      ]);
      expect(ids(service.findAll({ categoria: 'teatro', ciudad: '' }))).toEqual(
        [4, 5],
      );
    });

    it('rechaza un filtro repetido', () => {
      const repetidos = [
        { ciudad: ['Neiva', 'Bogotá'] },
        { categoria: ['teatro', 'cine'] },
        { categoria: ['teatro', 'teatro'] },
        { categoria: 'teatro', ciudad: ['Neiva', 'Neiva'] },
      ];
      for (const filtros of repetidos) {
        expect(() => service.findAll(filtros)).toThrow(BadRequestException);
        expect(() => service.findAll(filtros)).toThrow(
          /^Cada filtro admite un solo valor$/,
        );
      }
    });
  });

  describe('findOne', () => {
    it('devuelve el evento con el id pedido', () => {
      expect(service.findOne(4)).toEqual({
        id: 4,
        titulo: 'Cartas a Medianoche',
        descripcion: expect.stringMatching(/\S/),
        categoria: 'teatro',
        ciudad: 'Neiva',
        lugar: 'Teatro Municipal de Neiva',
        duracionMinutos: 90,
        clasificacion: '+13',
        imagenUrl: expect.stringMatching(/^https:\/\/placehold\.co\//),
      });
      expect(service.findOne(1).titulo).toBe('El Último Faro');
      expect(service.findOne(10).id).toBe(10);
      expect(service.findOne(10).ciudad).toBe('Íquira');
    });

    it('modificar el resultado no altera los datos internos', () => {
      service.findOne(1).titulo = 'Modificado';
      expect(service.findOne(1).titulo).toBe('El Último Faro');
    });

    it('lanza NotFoundException con «El evento 9999 no existe»', () => {
      expect(() => service.findOne(9999)).toThrow(NotFoundException);
      expect(() => service.findOne(9999)).toThrow(/^El evento 9999 no existe$/);
      // El contrato incluye el 0 y los negativos.
      expect(() => service.findOne(0)).toThrow(NotFoundException);
      expect(() => service.findOne(0)).toThrow(/^El evento 0 no existe$/);
      expect(() => service.findOne(-1)).toThrow(NotFoundException);
      expect(() => service.findOne(-1)).toThrow(/^El evento -1 no existe$/);
    });
  });

  describe('findCiudades', () => {
    it('devuelve las ciudades sin repetir y en orden alfabético', () => {
      // «Íquira» va entre «Bogotá» y «Neiva»: es el orden del español.
      expect(service.findCiudades()).toEqual([
        'Bogotá',
        'Íquira',
        'Neiva',
        'Pitalito',
      ]);
    });
  });

  it('los datos de ejemplo traen las cuatro categorías y al menos dos ciudades, una de ellas Neiva', () => {
    const eventos = service.findAll({});
    expect(eventos.length).toBeGreaterThanOrEqual(8);
    expect([...new Set(eventos.map((e) => e.categoria))].sort()).toEqual([
      'charla',
      'cine',
      'concierto',
      'teatro',
    ]);
    const ciudades = new Set(eventos.map((e) => e.ciudad));
    expect(ciudades.size).toBeGreaterThanOrEqual(2);
    expect(ciudades.has('Neiva')).toBe(true);
  });
});
