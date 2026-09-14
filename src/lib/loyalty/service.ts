import { prisma } from '@/lib/db';
import { ApiError } from '@/lib/api/errors';
import { canAddStamp, canRedeem, getCycleState } from './rules';
import { pushAppleUpdate } from '@/lib/apple/push';
import { syncGoogleObject } from '@/lib/google/wallet';
import type { LoyaltyCard } from '@prisma/client';

export interface RegisterCustomerInput {
  name: string;
  phone: string;
  email?: string | null;
}

export async function registerCustomer(input: RegisterCustomerInput) {
  const existing = await prisma.customer.findUnique({ where: { phone: input.phone } });
  if (existing) {
    throw new ApiError(409, 'CUSTOMER_EXISTS', 'Ya existe un cliente registrado con ese teléfono.');
  }

  const customer = await prisma.customer.create({
    data: {
      name: input.name,
      phone: input.phone,
      email: input.email || null,
      card: { create: {} },
    },
    include: { card: true },
  });

  // Best-effort: Google Loyalty Object creation shouldn't block signup if credentials aren't configured yet.
  if (customer.card) {
    syncGoogleObject(customer.card.id).catch((err) => {
      console.error('Google Wallet object creation failed for new customer', customer.id, err);
    });
  }

  return customer;
}

async function afterCardChange(cardId: string) {
  const card = await prisma.loyaltyCard.update({
    where: { id: cardId },
    data: { passUpdatedAt: new Date() },
  });
  await Promise.allSettled([
    pushAppleUpdate(card.id).catch((err) => console.error('Apple push failed', cardId, err)),
    syncGoogleObject(card.id).catch((err) => console.error('Google sync failed', cardId, err)),
  ]);
  return card;
}

function notFoundIfMissing(card: LoyaltyCard | null): LoyaltyCard {
  if (!card) throw new ApiError(404, 'CARD_NOT_FOUND', 'Tarjeta no encontrada.');
  return card;
}

export async function getCardByCustomerId(customerId: string) {
  const card = await prisma.loyaltyCard.findUnique({ where: { customerId } });
  return notFoundIfMissing(card);
}

export async function addStamp(customerId: string, staffUserId?: string) {
  const card = notFoundIfMissing(await prisma.loyaltyCard.findUnique({ where: { customerId } }));

  const check = canAddStamp(card);
  if (!check.ok) {
    const messages: Record<string, string> = {
      COMPLETED: 'El ciclo de este cliente está completo. Reinicia el ciclo antes de agregar sellos.',
      EXPIRED: 'Los sellos de este cliente vencieron. Reinicia el ciclo antes de continuar.',
      REWARD_PENDING: 'El cliente ya alcanzó el tope de sellos. Canjea su premio antes de agregar más.',
    };
    throw new ApiError(409, `STAMP_REJECTED_${check.reason}`, messages[check.reason]);
  }

  await prisma.$transaction([
    prisma.loyaltyCard.update({
      where: { id: card.id },
      data: {
        stamps: { increment: 1 },
        firstStampAt: card.firstStampAt ?? new Date(),
      },
    }),
    prisma.stampEvent.create({
      data: { cardId: card.id, staffUserId },
    }),
  ]);

  return afterCardChange(card.id);
}

export async function redeemReward(customerId: string, staffUserId?: string) {
  const card = notFoundIfMissing(await prisma.loyaltyCard.findUnique({ where: { customerId } }));

  const check = canRedeem(card);
  if (!check.ok) {
    const messages: Record<string, string> = {
      COMPLETED: 'El ciclo de este cliente ya está completo.',
      EXPIRED: 'Los sellos de este cliente vencieron. Reinicia el ciclo antes de continuar.',
      NOT_READY: 'El cliente todavía no alcanza la meta para canjear un premio.',
    };
    throw new ApiError(409, `REDEEM_REJECTED_${check.reason}`, messages[check.reason]);
  }

  const state = getCycleState(card);
  const isStage1 = state.stage === 'STAGE_1';

  await prisma.$transaction([
    prisma.loyaltyCard.update({
      where: { id: card.id },
      data: isStage1
        ? { stage: 'STAGE_2', reward1ClaimedAt: new Date() }
        : { stage: 'COMPLETED', reward2ClaimedAt: new Date() },
    }),
    prisma.redemptionEvent.create({
      data: { cardId: card.id, staffUserId, rewardType: isStage1 ? 'FREE_SHAKE' : 'SHAKER' },
    }),
  ]);

  return afterCardChange(card.id);
}

export async function resetCycle(customerId: string, staffUserId?: string) {
  const card = notFoundIfMissing(await prisma.loyaltyCard.findUnique({ where: { customerId } }));

  if (card.stage !== 'COMPLETED') {
    throw new ApiError(409, 'RESET_NOT_ALLOWED', 'Solo se puede reiniciar el ciclo cuando está completo.');
  }

  await prisma.$transaction([
    prisma.loyaltyCard.update({
      where: { id: card.id },
      data: {
        stamps: 0,
        stage: 'STAGE_1',
        reward1ClaimedAt: null,
        reward2ClaimedAt: null,
        firstStampAt: null,
        cycleStartedAt: new Date(),
        cycleNumber: { increment: 1 },
      },
    }),
    prisma.cycleResetEvent.create({ data: { cardId: card.id, staffUserId } }),
  ]);

  return afterCardChange(card.id);
}

export interface CustomerSearchResult {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  createdAt: Date;
  card: LoyaltyCard;
}

export async function searchCustomers(query: string, limit = 50): Promise<CustomerSearchResult[]> {
  const q = query.trim();
  const customers = await prisma.customer.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q } },
          ],
        }
      : undefined,
    include: { card: true },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return customers.filter((c): c is CustomerSearchResult => c.card !== null) as CustomerSearchResult[];
}

export async function findCardBySerial(serialNumber: string) {
  return prisma.loyaltyCard.findUnique({ where: { serialNumber }, include: { customer: true } });
}

export async function getAdminStats() {
  const cards = await prisma.loyaltyCard.findMany();
  const total = cards.length;
  const pending = cards.filter((c) => getCycleState(c).rewardReady).length;
  const claimed = cards.filter((c) => c.reward1ClaimedAt || c.reward2ClaimedAt).length;
  return { total, pending, claimed };
}
