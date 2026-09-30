export interface Client {
  id: number;
  name: string;
  email?: string | null;
  address?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  elector_key: string | null;
  current_balance: number;
  observations: string | null;
  phone: string | null;
  created_at: Date;
};