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

export const broadcastAudienceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('all') }),
  z.object({
    kind: z.literal('frequent'),
    minPurchases: z.coerce.number().int().min(1).max(100),
    days: z.coerce.number().int().min(1).max(365),
  }),
  z.object({ kind: z.literal('top'), limit: z.coerce.number().int().min(1).max(1000) }),
]);
export type BroadcastAudience = z.infer<typeof broadcastAudienceSchema>;

export const BROADCAST_MAX_LENGTH = 180;

export const sendBroadcastSchema = z.object({
  message: z.string().trim().min(3, 'Escribe el mensaje.').max(BROADCAST_MAX_LENGTH, `Máximo ${BROADCAST_MAX_LENGTH} caracteres.`),
  audience: broadcastAudienceSchema,
  customerIds: z.array(z.string().min(1)).min(1, 'Selecciona al menos un cliente.').max(5000),
});
