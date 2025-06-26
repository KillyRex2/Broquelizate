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
  integrations: [tailwind(), db(), auth(), react(), astroIcon()],
  output: "server",
  adapter: netlify(),
  
  vite: {
    define: {
      // Solo para variables que necesitan estar en el cliente
      'import.meta.env.PUBLIC_STRIPE_PUBLIC_KEY': JSON.stringify(process.env.PUBLIC_STRIPE_PUBLIC_KEY),
      
      // NO expongas la clave secreta en el cliente
    }
  }
});