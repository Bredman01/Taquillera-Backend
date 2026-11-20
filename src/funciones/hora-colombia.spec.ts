import { diaEnColombia, ZONA_COLOMBIA } from './hora-colombia.js';

// D5: en el hilo principal las pruebas corren en Asia/Tokyo, 14 h por delante
// de Colombia, para que un código que use la hora local del servidor dé otro
// día y otra hora. La zona se asigna en vi.hoisted, que corre antes de los
// import: el formateador Intl de hora-colombia.ts se crea al importar el
// módulo y fija su zona en ese momento. Asignada en beforeAll llegaría tarde,
// y un formateador sin `timeZone` tomaría la zona de la máquina. Stryker usa
// hilos y allí asignar TZ no cambia la zona: por eso solo se fuerza en el
// hilo principal. vi.hoisted no puede usar los import del archivo, así que
// isMainThread se importa dentro.
const { zonaOriginal, zonaForzada } = await vi.hoisted(async () => {
  const { isMainThread } = await import('node:worker_threads');
  const original = process.env.TZ;
  if (isMainThread) {
    process.env.TZ = 'Asia/Tokyo';
  }
  return { zonaOriginal: original, zonaForzada: isMainThread };
});

if (zonaForzada) {
  afterAll(() => {
    if (zonaOriginal === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = zonaOriginal;
    }
  });

  it('las pruebas corren en Asia/Tokyo, fuera de la zona de Colombia', () => {
    expect(new Date('2026-11-22T03:30:00Z').getHours()).toBe(12);
  });
}

// [hora de entrada, día en Colombia]
const CASOS: Array<[string, string]> = [
  // Las horas de los datos de ejemplo, con el desfase de Colombia. Las de la
  // tarde y la noche caen en otro día en UTC; la de la mañana, en Tokio.
  ['2026-11-21T18:00:00-05:00', '2026-11-21'],
  ['2026-11-22T15:00:00-05:00', '2026-11-22'],
  ['2026-11-22T19:30:00-05:00', '2026-11-22'],
  ['2026-11-21T23:30:00-05:00', '2026-11-21'],
  ['2026-11-21T16:00:00-05:00', '2026-11-21'],
  ['2026-11-21T20:00:00-05:00', '2026-11-21'],
  ['2026-11-22T21:00:00-05:00', '2026-11-22'],
  ['2026-11-22T10:30:00-05:00', '2026-11-22'],
  // Los extremos del día de Colombia, con su propio desfase.
  ['2026-11-21T00:00:00-05:00', '2026-11-21'],
  ['2026-11-21T23:59:59-05:00', '2026-11-21'],
  // Horas en UTC: Colombia va 5 h atrás, así que hasta las 04:59:59Z sigue
  // siendo el día anterior y desde las 05:00:00Z es el mismo día.
  ['2026-11-22T04:30:00Z', '2026-11-21'],
  ['2026-11-22T04:59:59Z', '2026-11-21'],
  ['2026-11-22T04:59:59.999Z', '2026-11-21'],
  ['2026-11-22T05:00:00Z', '2026-11-22'],
  ['2026-11-22T00:00:00Z', '2026-11-21'],
  ['2026-11-21T12:00:00Z', '2026-11-21'],
  ['2026-11-22T23:59:59Z', '2026-11-22'],
  // Horas con otro desfase: se parte del instante, no del texto.
  ['2026-11-22T10:00:00+09:00', '2026-11-21'],
  ['2026-11-22T00:30:00+01:00', '2026-11-21'],
  ['2026-11-22T06:00:00+01:00', '2026-11-22'],
  // Cambios de mes y de año, y un año bisiesto.
  ['2026-12-01T04:59:59Z', '2026-11-30'],
  ['2026-12-01T05:00:00Z', '2026-12-01'],
  ['2027-01-01T04:59:59Z', '2026-12-31'],
  ['2027-01-01T05:00:00Z', '2027-01-01'],
  ['2026-03-01T04:59:59Z', '2026-02-28'],
  ['2028-03-01T04:59:59Z', '2028-02-29'],
  // Mes y día de una sola cifra se escriben con dos.
  ['2026-01-05T12:00:00-05:00', '2026-01-05'],
  ['2026-09-09T09:09:09-05:00', '2026-09-09'],
];

describe('hora de Colombia', () => {
  it('la zona de Colombia es America/Bogota', () => {
    expect(ZONA_COLOMBIA).toBe('America/Bogota');
  });

  it('diaEnColombia da el día de Colombia sin importar el desfase con que venga la hora', () => {
    for (const [inicio, dia] of CASOS) {
      expect(diaEnColombia(inicio), inicio).toBe(dia);
    }
  });
});
