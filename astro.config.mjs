// @ts-check
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
});