// astro.config.mjs
import { defineConfig } from 'astro/config';
import tailwind from "@astrojs/tailwind";
import netlify from "@astrojs/netlify";
import astroIcon from 'astro-icon';
import db from "@astrojs/db";
import auth from "auth-astro";
import react from "@astrojs/react";

// https://astro.build/config
export default defineConfig({
  integrations: [tailwind(), db({ seedOnStartup: false }), auth(), react(), astroIcon()],
  output: "server",
  adapter: netlify(),

  vite: {
    optimizeDeps: {
      // Se declaran para que Vite las pre-bundlee al arrancar.
      // Si las descubre a media sesión, cambia sus hashes y el
      // navegador se queda pidiendo los viejos: de ahí el
      // "504 (Outdated Optimize Dep)" en desarrollo.
      include: [
        'react-icons/fa',
        'react-icons/fa6',
        'react-icons/ai',
        'react-icons/bs',
        'react-icons/gi',
        'react-icons/md',
        'react-icons/tb',
        'react-icons/io5',
        'react-icons/hi2',
      ],
    },
  },
});