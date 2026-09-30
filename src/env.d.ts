// src/env.d.ts
/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface User {
  id?: string;
  name: string;
  email: string;
  phone?: string | null;
  shippingAddress?: string | null;
  createdAt?: Date | string | null;
  rol?: string;
}

declare namespace App {
  interface Locals {
    isLoggedIn: boolean;
    user: User | null;
    isAdmin: boolean;
  }
}
