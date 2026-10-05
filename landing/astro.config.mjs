// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://home-cloud.live',
  output: 'static',
  server: { port: 4321, host: true },
});
