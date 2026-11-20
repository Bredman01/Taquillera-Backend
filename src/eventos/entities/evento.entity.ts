export type Categoria = 'cine' | 'teatro' | 'concierto' | 'charla';

export const CATEGORIAS: readonly Categoria[] = [
  'cine',
  'teatro',
  'concierto',
  'charla',
];

export type Clasificacion = 'TP' | '+7' | '+13' | '+16' | '+18';

export const CLASIFICACIONES: readonly Clasificacion[] = [
  'TP',
  '+7',
  '+13',
  '+16',
  '+18',
];

export interface Evento {
  id: number;
  titulo: string;
  descripcion: string;
  categoria: Categoria;
  ciudad: string;
  lugar: string;
  duracionMinutos: number;
  clasificacion: Clasificacion;
  imagenUrl: string;
}
