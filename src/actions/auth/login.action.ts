
import { defineAction } from "astro:actions";
import { z } from 'astro:schema';


export const loginUser = defineAction({
  accept: 'form',
  input: z.object({
    email: z.string().email(),
    password: z.string().min(6),
    remember_me: z.boolean().optional(),
  }),
  handler: async ({ email, password, remember_me }, { cookies }) => {
    return {ok: true};
  },
});