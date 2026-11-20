import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { AsientosService } from '../asientos/asientos.service.js';
import { FuncionesService } from '../funciones/funciones.service.js';
import { fechaHoraEnColombia } from '../funciones/hora-colombia.js';
import type { CrearCompraDto } from './dto/crear-compra.dto.js';
import type { Compra, CompraCreada } from './entities/compra.entity.js';
import { GeneradorCodigo } from './generador-codigo.js';
import { Reloj } from './reloj.js';

const MAXIMO_POR_COMPRA = 6;
const MAXIMO_NOMBRE = 100;
const MAXIMO_CORREO = 254;
const INTENTOS_DE_CODIGO = 10;
const FORMATO_DE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function malaPeticion(mensaje: string): BadRequestException {
  return new BadRequestException({
    statusCode: 400,
    message: mensaje,
    error: 'Bad Request',
  });
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function esListaDeTextos(valor: unknown): valor is string[] {
  return (
    Array.isArray(valor) &&
    valor.every((elemento) => typeof elemento === 'string')
  );
}

@Injectable()
export class ComprasService {
  // Las compras guardadas, con el código como clave. Aquí no se guardan los
  // asientos tomados: eso lo hace solo el servicio de asientos.
  private readonly compras = new Map<string, Compra>();

  constructor(
    private readonly funciones: FuncionesService,
    private readonly asientos: AsientosService,
    private readonly generador: GeneradorCodigo,
    private readonly reloj: Reloj,
  ) {}

  // Crea la compra o lanza, en este orden: 404 si la función no existe, 400 si
  // el cuerpo no es válido, 500 si no hay un código libre y 409 si algún
  // asiento ya no está disponible. Es síncrono a propósito: el servicio de
  // asientos comprueba y ocupa sin esperar nada, así que ninguna otra compra
  // se cuela en medio.
  crear(funcionId: number, cuerpo: unknown): CompraCreada {
    const funcion = this.funciones.findOne(funcionId);
    const { asientos, nombre, correo } = this.validar(cuerpo);
    const codigo = this.pedirCodigo();

    this.asientos.ocupar(funcionId, asientos);

    const compra: Compra = {
      codigo,
      funcionId,
      asientos: [...asientos],
      total: funcion.precio * asientos.length,
      fecha: fechaHoraEnColombia(this.reloj.ahora()),
      nombre,
      correo,
    };
    this.compras.set(codigo, compra);

    return {
      codigo,
      funcionId,
      asientos: [...compra.asientos],
      total: compra.total,
      fecha: compra.fecha,
    };
  }

  // Lee una compra por su código, exacto: no cambia mayúsculas ni recorta
  // espacios. Devuelve una copia, también de la lista de asientos, así que
  // modificarla no altera lo guardado. Si no hay compra, devuelve undefined.
  findByCodigo(codigo: string): Compra | undefined {
    const compra = this.compras.get(codigo);
    if (compra === undefined) {
      return undefined;
    }
    return { ...compra, asientos: [...compra.asientos] };
  }

  // Responde con la primera regla que falla. Un cuerpo que no es un objeto se
  // trata como un objeto vacío. El nombre y el correo salen recortados.
  private validar(cuerpo: unknown): CrearCompraDto {
    const datos: Record<string, unknown> = esObjeto(cuerpo) ? cuerpo : {};

    const { asientos } = datos;
    if (!esListaDeTextos(asientos)) {
      throw malaPeticion('La lista de asientos no es válida');
    }
    if (asientos.length === 0) {
      throw malaPeticion('Elige al menos un asiento');
    }
    if (asientos.length > MAXIMO_POR_COMPRA) {
      throw malaPeticion(
        `Puedes comprar máximo ${MAXIMO_POR_COMPRA} boletas por compra`,
      );
    }

    // Se nombra el primer asiento que ya había aparecido antes en la lista.
    const vistos = new Set<string>();
    for (const id of asientos) {
      if (vistos.has(id)) {
        throw malaPeticion(`El asiento ${id} está repetido`);
      }
      vistos.add(id);
    }

    const inexistente = asientos.find(
      (id) => !this.asientos.existeEnElPlano(id),
    );
    if (inexistente !== undefined) {
      throw malaPeticion(`El asiento ${inexistente} no existe en el lugar`);
    }

    const nombre = typeof datos.nombre === 'string' ? datos.nombre.trim() : '';
    if (nombre === '') {
      throw malaPeticion('Escribe tu nombre completo');
    }
    if (nombre.length > MAXIMO_NOMBRE) {
      throw malaPeticion(`El nombre admite máximo ${MAXIMO_NOMBRE} caracteres`);
    }

    const correo = typeof datos.correo === 'string' ? datos.correo.trim() : '';
    if (correo.length > MAXIMO_CORREO || !FORMATO_DE_CORREO.test(correo)) {
      throw malaPeticion('Escribe un correo electrónico válido');
    }

    return { asientos, nombre, correo };
  }

  // Pide códigos al generador hasta dar con uno que no esté guardado, con un
  // máximo de intentos. Se pide antes de ocupar: si falla, no queda nada tomado.
  private pedirCodigo(): string {
    for (let intento = 0; intento < INTENTOS_DE_CODIGO; intento += 1) {
      const codigo = this.generador.generar();
      if (!this.compras.has(codigo)) {
        return codigo;
      }
    }
    throw new InternalServerErrorException({
      statusCode: 500,
      message: 'No se pudo generar un código de compra único',
      error: 'Internal Server Error',
    });
  }
}
