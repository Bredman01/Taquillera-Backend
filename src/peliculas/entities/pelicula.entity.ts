export type Clasificacion = 'TP' | '+7' | '+13' | '+16' | '+18';

export const CLASIFICACIONES: readonly Clasificacion[] = [
  'TP',
  '+7',
  '+13',
  '+16',
  '+18',
];

export interface Pelicula {
  id: number;
  titulo: string;
  sinopsis: string;
  duracionMinutos: number;
  clasificacion: Clasificacion;
  genero: string;
  imagenUrl: string;
}
