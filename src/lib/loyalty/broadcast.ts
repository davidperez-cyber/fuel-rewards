import { prisma } from '@/lib/db';
import { pushAppleUpdate } from '@/lib/apple/push';
import { sendGoogleWalletMessage } from '@/lib/google/wallet';
import type { BroadcastAudience } from '@/lib/validation';

export interface AudienceRow {
  id: string; // customer id
  name: string;
  phone: string;
  purchases: number; // paid shakes (stamps) ever
  recentPurchases: number | null; // paid shakes inside the "frequent" window, when that filter is used
  appleDevices: number; // iPhones with the pass that receive updates
  google: boolean; // has a Google Wallet card
}

export function describeAudience(a: BroadcastAudience): string {
  if (a.kind === 'all') return 'Todos los clientes';
  if (a.kind === 'frequent') return `Frecuentes: ${a.minPurchases}+ compras en los últimos ${a.days} días`;
  return `Top ${a.limit}: los que más han comprado`;
}

/** Customers matching an audience filter, most purchases first. "Purchases" are stamps (paid Protein Shakes). */
export async function findAudience(a: BroadcastAudience): Promise<AudienceRow[]> {
  const customers = await prisma.customer.findMany({
    where: { card: { isNot: null } },
    include: { card: { include: { _count: { select: { appleDevices: true } } } } },
  });

  const totals = await prisma.stampEvent.groupBy({ by: ['cardId'], _count: { _all: true } });
  const totalByCard = new Map(totals.map((t) => [t.cardId, t._count._all]));

  let recentByCard: Map<string, number> | null = null;
  if (a.kind === 'frequent') {
    const since = new Date(Date.now() - a.days * 24 * 60 * 60 * 1000);
    const recent = await prisma.stampEvent.groupBy({
      by: ['cardId'],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    });
    recentByCard = new Map(recent.map((t) => [t.cardId, t._count._all]));
  }

  let rows: AudienceRow[] = customers.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    purchases: totalByCard.get(c.card!.id) ?? 0,
    recentPurchases: recentByCard ? recentByCard.get(c.card!.id) ?? 0 : null,
    appleDevices: c.card!._count.appleDevices,
    google: Boolean(c.card!.googleObjectId),
  }));

  if (a.kind === 'frequent') {
    rows = rows.filter((r) => (r.recentPurchases ?? 0) >= a.minPurchases);
    rows.sort((x, y) => (y.recentPurchases ?? 0) - (x.recentPurchases ?? 0) || y.purchases - x.purchases);
  } else {
    rows.sort((x, y) => y.purchases - x.purchases || x.name.localeCompare(y.name));
    if (a.kind === 'top') rows = rows.filter((r) => r.purchases > 0).slice(0, a.limit);
  }
  return rows;
}

export interface BroadcastResult {
  recipients: number;
  appleDevices: number;
  googleCards: number;
  noWallet: number; // selected customers who don't have the card in any Wallet
}

const CONCURRENCY = 8;

/**
 * Sends an admin-written message to the selected customers' Wallet cards:
 *  - Apple: the text becomes the pass's "Novedades" field (which has a changeMessage), then an APNs push
 *    makes the iPhone refetch the pass and show the text as a lock-screen notification.
 *  - Google: the text is added as a message with notification on the customer's Loyalty Object.
 */
export async function sendBroadcast(input: {
  message: string;
  customerIds: string[];
  audienceLabel: string;
  staffUserId?: string;
}): Promise<BroadcastResult> {
  const cards = await prisma.loyaltyCard.findMany({ where: { customerId: { in: input.customerIds } } });
  const result: BroadcastResult = { recipients: cards.length, appleDevices: 0, googleCards: 0, noWallet: 0 };

  const sendOne = async (card: (typeof cards)[number]) => {
    // Wallet only notifies when the field's text changes: if this card already shows the very same
    // message, add an invisible character so a repeated message still notifies.
    const text = card.walletMessage === input.message ? `${input.message}​` : input.message;
    await prisma.loyaltyCard.update({
      where: { id: card.id },
      data: { walletMessage: text, passUpdatedAt: new Date() },
    });
    const [apple, google] = await Promise.all([
      pushAppleUpdate(card.id).catch((err) => {
        console.error('Broadcast: Apple push failed', card.id, err);
        return 0;
      }),
      sendGoogleWalletMessage(card.googleObjectId, input.message).catch((err) => {
        console.error('Broadcast: Google message failed', card.id, err);
        return false;
      }),
    ]);
    result.appleDevices += apple;
    if (google) result.googleCards += 1;
    if (apple === 0 && !google) result.noWallet += 1;
  };

  for (let i = 0; i < cards.length; i += CONCURRENCY) {
    await Promise.all(cards.slice(i, i + CONCURRENCY).map(sendOne));
  }

  await prisma.walletBroadcast.create({
    data: {
      message: input.message,
      audience: input.audienceLabel,
      recipients: result.recipients,
      appleDevices: result.appleDevices,
      googleCards: result.googleCards,
      staffUserId: input.staffUserId,
    },
  });
  return result;
}

export async function listBroadcasts(limit = 20) {
  const rows = await prisma.walletBroadcast.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { staffUser: { select: { name: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    message: r.message,
    audience: r.audience,
    recipients: r.recipients,
    appleDevices: r.appleDevices,
    googleCards: r.googleCards,
    sentBy: r.staffUser?.name ?? null,
    createdAt: r.createdAt.toISOString(),
  }));
}
