import { GeneradorCodigo } from './generador-codigo.js';

const CARACTERES_POSIBLES = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

describe('GeneradorCodigo', () => {
  // Sin criterio (D6): el formato del código de la compra, que la nota del
  // dominio fija en 8 caracteres de letras mayúsculas y números, sin repetir.
  it('generar devuelve 8 caracteres de A-Z y 0-9, con letras y números, y sin repetir en 1000 llamadas', () => {
    const generador = new GeneradorCodigo();

    const codigos = Array.from({ length: 1000 }, () => generador.generar());

    for (const codigo of codigos) {
      expect(codigo).toMatch(/^[A-Z0-9]{8}$/);
    }

    // Con 8.000 caracteres elegidos al azar, aparecen los 36 posibles: las 26
    // letras y los 10 dígitos.
    const usados = [...new Set(codigos.join(''))].sort().join('');
    expect(usados).toBe(CARACTERES_POSIBLES);

    // Cada posición del código varía: no hay un prefijo ni un sufijo fijo.
    for (let posicion = 0; posicion < 8; posicion += 1) {
      const distintos = new Set(codigos.map((codigo) => codigo[posicion]));
      expect(distintos.size, `posición ${posicion}`).toBeGreaterThan(30);
    }

    // 36⁸ códigos posibles: mil llamadas no se repiten.
    expect(new Set(codigos).size).toBe(1000);
  });
});
