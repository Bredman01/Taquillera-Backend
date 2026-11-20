import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CATEGORIAS } from './entities/evento.entity.js';
import type { Evento } from './entities/evento.entity.js';

export interface FiltrosEventos {
  categoria?: string | string[];
  ciudad?: string | string[];
}

const sinTildes = (texto: string): string =>
  texto.normalize('NFD').replace(/\p{M}/gu, '');

const normalizar = (texto: string): string =>
  sinTildes(texto).toLocaleLowerCase('es').trim();

const afiche = (titulo: string): string =>
  `https://placehold.co/400x600/png?text=${encodeURIComponent(sinTildes(titulo)).replace(/%20/g, '+')}`;

@Injectable()
export class EventosService {
  private readonly eventos: Evento[] = [
    {
      id: 1,
      titulo: 'El Último Faro',
      descripcion:
        'Un farero solitario descubre un mensaje que cambia la historia de su pueblo.',
      categoria: 'cine',
      ciudad: 'Neiva',
      lugar: 'Cine Club La Gaitana',
      duracionMinutos: 118,
      clasificacion: '+13',
      imagenUrl: afiche('El Último Faro'),
    },
    {
      id: 2,
      titulo: 'Galaxia Perdida',
      descripcion:
        'La tripulación de una nave de carga queda varada en un sistema que no aparece en ningún mapa.',
      categoria: 'cine',
      ciudad: 'Bogotá',
      lugar: 'Cinemateca Central',
      duracionMinutos: 132,
      clasificacion: '+7',
      imagenUrl: afiche('Galaxia Perdida'),
    },
    {
      id: 3,
      titulo: 'Risas en Familia',
      descripcion:
        'Tres generaciones comparten una casa durante las vacaciones y nada sale como lo planearon.',
      categoria: 'cine',
      ciudad: 'Pitalito',
      lugar: 'Casa de la Cultura de Pitalito',
      duracionMinutos: 95,
      clasificacion: 'TP',
      imagenUrl: afiche('Risas en Familia'),
    },
    {
      id: 4,
      titulo: 'Cartas a Medianoche',
      descripcion:
        'Una actriz retirada recibe cada noche una carta sin remitente.',
      categoria: 'teatro',
      ciudad: 'Neiva',
      lugar: 'Teatro Municipal de Neiva',
      duracionMinutos: 90,
      clasificacion: '+13',
      imagenUrl: afiche('Cartas a Medianoche'),
    },
    {
      id: 5,
      titulo: 'El Inspector Distraído',
      descripcion:
        'Un inspector despistado persigue a un ladrón por todo el teatro.',
      categoria: 'teatro',
      ciudad: 'Bogotá',
      lugar: 'Teatro del Parque',
      duracionMinutos: 80,
      clasificacion: 'TP',
      imagenUrl: afiche('El Inspector Distraído'),
    },
    {
      id: 6,
      titulo: 'Bambucos al Atardecer',
      descripcion:
        'Un concierto de bambucos y pasillos para despedir la tarde.',
      categoria: 'concierto',
      ciudad: 'Neiva',
      lugar: 'Concha Acústica del Malecón',
      duracionMinutos: 120,
      clasificacion: 'TP',
      imagenUrl: afiche('Bambucos al Atardecer'),
    },
    {
      id: 7,
      titulo: 'Rock del Valle de Laboyos',
      descripcion:
        'Cuatro bandas del sur del Huila tocan rock durante una noche.',
      categoria: 'concierto',
      ciudad: 'Pitalito',
      lugar: 'Coliseo Cubierto de Pitalito',
      duracionMinutos: 150,
      clasificacion: '+16',
      imagenUrl: afiche('Rock del Valle de Laboyos'),
    },
    {
      id: 8,
      titulo: 'Del Grano a la Taza',
      descripcion:
        'Un caficultor explica cómo se cultiva y se prepara un buen café.',
      categoria: 'charla',
      ciudad: 'Neiva',
      lugar: 'Biblioteca Departamental',
      duracionMinutos: 60,
      clasificacion: 'TP',
      imagenUrl: afiche('Del Grano a la Taza'),
    },
    {
      id: 9,
      titulo: 'Inteligencia Artificial sin Miedo',
      descripcion:
        'Una charla sencilla sobre lo que hace la inteligencia artificial.',
      categoria: 'charla',
      ciudad: 'Bogotá',
      lugar: 'Auditorio Central',
      duracionMinutos: 75,
      clasificacion: 'TP',
      imagenUrl: afiche('Inteligencia Artificial sin Miedo'),
    },
    {
      id: 10,
      titulo: 'Historia del Huila en Cinco Objetos',
      descripcion:
        'Cinco objetos antiguos sirven para contar la historia del Huila.',
      categoria: 'charla',
      ciudad: 'Íquira',
      lugar: 'Casa de la Cultura de Íquira',
      duracionMinutos: 50,
      clasificacion: 'TP',
      imagenUrl: afiche('Historia del Huila en Cinco Objetos'),
    },
  ];

  findAll(filtros: FiltrosEventos): Evento[] {
    const categoria = this.leerFiltro(filtros.categoria);
    const ciudad = this.leerFiltro(filtros.ciudad);

    if (
      categoria !== undefined &&
      !CATEGORIAS.some((valida) => valida === categoria)
    ) {
      throw new BadRequestException(`La categoría ${categoria} no existe`);
    }

    const ciudadBuscada = ciudad === undefined ? undefined : normalizar(ciudad);

    return this.eventos
      .filter(
        (evento) =>
          (categoria === undefined || evento.categoria === categoria) &&
          (ciudadBuscada === undefined ||
            normalizar(evento.ciudad) === ciudadBuscada),
      )
      .map((evento) => ({ ...evento }));
  }

  findOne(id: number): Evento {
    const evento = this.eventos.find((e) => e.id === id);
    if (!evento) {
      throw new NotFoundException(`El evento ${id} no existe`);
    }
    return { ...evento };
  }

  findCiudades(): string[] {
    const ciudades = new Set(this.eventos.map((evento) => evento.ciudad));
    return [...ciudades].sort((a, b) => a.localeCompare(b, 'es'));
  }

  private leerFiltro(valor: string | string[] | undefined): string | undefined {
    if (Array.isArray(valor)) {
      throw new BadRequestException('Cada filtro admite un solo valor');
    }
    return valor === '' ? undefined : valor;
  }
}
