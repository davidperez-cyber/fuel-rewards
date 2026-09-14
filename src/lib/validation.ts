import { z } from 'zod';

export const registerCustomerSchema = z.object({
  name: z.string().trim().min(2, 'El nombre es requerido.').max(120),
  phone: z
    .string()
    .trim()
    .min(7, 'Teléfono inválido.')
    .max(20)
    .regex(/^[0-9+()\-\s]+$/, 'Teléfono inválido.'),
  email: z.union([z.literal(''), z.string().trim().email('Correo inválido.')]).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});
