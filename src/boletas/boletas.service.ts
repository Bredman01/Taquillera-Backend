import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AsientosService } from '../asientos/asientos.service.js';
import type { FuncionConEvento } from '../asientos/entities/funcion-con-evento.entity.js';
import { ComprasService } from '../compras/compras.service.js';
import type { Compra } from '../compras/entities/compra.entity.js';
import { Reloj } from '../compras/reloj.js';
import { fechaHoraEnColombia } from '../funciones/hora-colombia.js';
import type { Boleta } from './entities/boleta.entity.js';

function noExiste(codigo: string): NotFoundException {
  return new NotFoundException({
    statusCode: 404,
    message: `La boleta ${codigo} no existe`,
    error: 'Not Found',
  });
}

// Arma la boleta con solo los nueve campos que la API responde. La lista de
// asientos es una copia: modificar lo devuelto no altera la compra.
function armarBoleta(
  codigo: string,
  compra: Compra,
  funcion: FuncionConEvento,
  fechaUso: string | undefined,
): Boleta {
  const datos = {
    codigo,
    titulo: funcion.titulo,
    inicio: funcion.inicio,
    lugar: funcion.lugar,
    ciudad: funcion.ciudad,
    asientos: [...compra.asientos],
    nombre: compra.nombre,
  };
  return fechaUso === undefined
    ? { ...datos, estado: 'valida', fechaUso: null }
    : { ...datos, estado: 'usada', fechaUso };
}

@Injectable()
export class BoletasService {
  // El uso de cada boleta: el código en mayúsculas y la fecha del primer uso.
  // La boleta es la compra, que guarda ComprasService; aquí solo vive el uso.
  private readonly usos = new Map<string, string>();

  constructor(
    private readonly compras: ComprasService,
    private readonly asientos: AsientosService,
    private readonly reloj: Reloj,
  ) {}

  // Lee la boleta de una compra. El código se acepta en mayúsculas o en
  // minúsculas y la respuesta lleva el código en mayúsculas. Si no hay compra
  // con ese código responde 404.
  findByCodigo(codigo: string): Boleta {
    const canonico = codigo.toUpperCase();
    const compra = this.compras.findByCodigo(canonico);
    if (compra === undefined) {
      throw noExiste(canonico);
    }
    const funcion = this.asientos.findFuncion(compra.funcionId);
    return armarBoleta(canonico, compra, funcion, this.usos.get(canonico));
  }

  // Marca la boleta como usada, una sola vez, o lanza: 404 si no existe y 409
  // si ya se usó, con la fecha del primer uso, que no cambia. Es síncrono a
  // propósito: sin ningún `await` entre comprobar el uso y guardarlo, Node no
  // atiende otra petición en medio, así que dos validaciones seguidas de la
  // misma boleta no pueden dar las dos por buenas. La función se lee antes de
  // marcar para que un fallo no deje un uso a medias.
  validar(codigo: string): Boleta {
    const canonico = codigo.toUpperCase();
    const compra = this.compras.findByCodigo(canonico);
    if (compra === undefined) {
      throw noExiste(canonico);
    }
    const funcion = this.asientos.findFuncion(compra.funcionId);

    const primerUso = this.usos.get(canonico);
    if (primerUso !== undefined) {
      throw new ConflictException({
        statusCode: 409,
        message: `La boleta ${canonico} ya fue usada`,
        error: 'Conflict',
        fechaUso: primerUso,
      });
    }

    const fechaUso = fechaHoraEnColombia(this.reloj.ahora());
    this.usos.set(canonico, fechaUso);
    return armarBoleta(canonico, compra, funcion, fechaUso);
  }
}
