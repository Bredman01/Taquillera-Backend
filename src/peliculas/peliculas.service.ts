import { Injectable, NotFoundException } from '@nestjs/common';
import { Pelicula } from './entities/pelicula.entity.js';

const poster = (texto: string): string =>
  `https://placehold.co/400x600/png?text=${encodeURIComponent(texto).replace(/%20/g, '+')}`;

@Injectable()
export class PeliculasService {
  private readonly peliculas: Pelicula[] = [
    {
      id: 1,
      titulo: 'El Último Faro',
      sinopsis:
        'Un farero solitario descubre un mensaje que cambia la historia de su pueblo.',
      duracionMinutos: 118,
      clasificacion: '+13',
      genero: 'Drama',
      imagenUrl: poster('El Ultimo Faro'),
    },
    {
      id: 2,
      titulo: 'Galaxia Perdida',
      sinopsis:
        'La tripulación de una nave de carga queda varada en un sistema que no aparece en ningún mapa.',
      duracionMinutos: 132,
      clasificacion: '+7',
      genero: 'Ciencia ficción',
      imagenUrl: poster('Galaxia Perdida'),
    },
    {
      id: 3,
      titulo: 'Risas en Familia',
      sinopsis:
        'Tres generaciones comparten una casa durante las vacaciones y nada sale como lo planearon.',
      duracionMinutos: 95,
      clasificacion: 'TP',
      genero: 'Comedia',
      imagenUrl: poster('Risas en Familia'),
    },
    {
      id: 4,
      titulo: 'Sombras del Pantano',
      sinopsis:
        'Un grupo de biólogos acampa junto a un pantano donde cada noche desaparece alguien.',
      duracionMinutos: 104,
      clasificacion: '+18',
      genero: 'Terror',
      imagenUrl: poster('Sombras del Pantano'),
    },
    {
      id: 5,
      titulo: 'La Ruta del Café',
      sinopsis:
        'Dos amigos recorren las montañas del Huila buscando la finca que produce el mejor café del país.',
      duracionMinutos: 110,
      clasificacion: '+7',
      genero: 'Aventura',
      imagenUrl: poster('La Ruta del Cafe'),
    },
    {
      id: 6,
      titulo: 'Código Rojo',
      sinopsis:
        'Una agente de seguridad informática tiene una noche para detener un ataque a la red eléctrica.',
      duracionMinutos: 126,
      clasificacion: '+16',
      genero: 'Acción',
      imagenUrl: poster('Codigo Rojo'),
    },
  ];

  findAll(): Pelicula[] {
    return this.peliculas.map((pelicula) => ({ ...pelicula }));
  }

  findOne(id: number): Pelicula {
    const pelicula = this.peliculas.find((p) => p.id === id);
    if (!pelicula) {
      throw new NotFoundException(`La película ${id} no existe`);
    }
    return { ...pelicula };
  }
}
