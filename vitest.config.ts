import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`. Requires Vite 8, which ships this option.
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      // Mide todo src/, no solo los archivos que alguna prueba importa.
      include: ['src/**/*.ts'],
      // main.ts es el arranque del servidor y lo cubren las pruebas e2e.
      exclude: ['src/main.ts', 'src/**/*.spec.ts'],
      reporter: ['text', 'json-summary'],
      // Piso, no meta: el CI falla por debajo del 80 % de líneas.
      thresholds: { lines: 80 },
    },
  },
});
