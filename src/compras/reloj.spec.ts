import { Reloj } from './reloj.js';

describe('Reloj', () => {
  // El reloj simulado de una prueba no pasa a la siguiente.
  afterEach(() => {
    vi.useRealTimers();
  });

  // Sin criterio (D7): el único lugar del backend que lee la hora del sistema.
  it('ahora devuelve la hora del sistema', () => {
    vi.useFakeTimers();
    const reloj = new Reloj();

    vi.setSystemTime(Date.parse('2026-11-19T20:04:05.123Z'));
    expect(reloj.ahora()).toBe(Date.parse('2026-11-19T20:04:05.123Z'));

    // Lee la hora en cada llamada: no guarda la primera.
    vi.setSystemTime(Date.parse('2027-01-01T00:00:00.000Z'));
    expect(reloj.ahora()).toBe(Date.parse('2027-01-01T00:00:00.000Z'));

    // Y sigue el paso del tiempo, en milisegundos.
    vi.advanceTimersByTime(1500);
    expect(reloj.ahora()).toBe(Date.parse('2027-01-01T00:00:01.500Z'));
  });
});
