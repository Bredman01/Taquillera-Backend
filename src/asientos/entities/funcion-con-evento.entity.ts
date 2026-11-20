import type { Funcion } from '../../funciones/entities/funcion.entity.js';

// Una función junto con los datos de su evento que la pantalla necesita.
export interface FuncionConEvento extends Funcion {
  titulo: string;
  ciudad: string;
  lugar: string;
}
