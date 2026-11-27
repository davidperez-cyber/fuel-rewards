import type { CardStage } from '@prisma/client';

/**
 * Core business rules for the "Protein Shake Rewards" / "Camino al Shaker" program.
 * Mirrors design_handoff_rewards_platform/README.md ("Reglas del programa de lealtad").
 *
 * `stamps` is a single cumulative counter per cycle: 0-6 while in STAGE_1, 6-14 while in
 * STAGE_2 (the prototype's convention — stage 2 keeps counting from the same number rather
 * than restarting at 0), matching `Rewards Platform.dc.html`'s buildTierInfo().
 */

export const STAGE_1_GOAL = 6; // stamps needed for the free shake
export const STAGE_2_GOAL = 14; // stamps needed for the shaker (= 15 total purchases)

export interface CardLike {
  stamps: number;
  stage: CardStage;
  reward1ClaimedAt: Date | null;
  reward2ClaimedAt: Date | null;
  firstStampAt: Date | null;
}

export interface CycleState {
  stage: CardStage;
  stamps: number;
  goal: number;
  rewardReady: boolean;
  rewardType: 'FREE_SHAKE' | 'SHAKER' | null;
  isExpired: boolean;
  /** The previous cycle expired and this state is its automatic restart. */
  previousCycleExpired: boolean;
  expiresAt: Date | null;
  daysRemaining: number | null;
  programTitle: string;
  programSub: string;
  progressText: string;
  stampsLabel: string;
}

export function stampWindowDays(): number {
  const raw = process.env.STAMP_WINDOW_DAYS;
  const n = raw ? parseInt(raw, 10) : 30;
  return Number.isFinite(n) && n > 0 ? n : 30;
}

export function computeExpiresAt(firstStampAt: Date | null, windowDays = stampWindowDays()): Date | null {
  if (!firstStampAt) return null;
  return new Date(firstStampAt.getTime() + windowDays * 24 * 60 * 60 * 1000);
}

export function isCardExpired(card: CardLike, now = new Date(), windowDays = stampWindowDays()): boolean {
  if (card.stage === 'COMPLETED') return false;
  const expiresAt = computeExpiresAt(card.firstStampAt, windowDays);
  if (!expiresAt) return false;
  return now.getTime() > expiresAt.getTime();
}

/**
 * Expired cycles restart automatically: once the stamp window has passed, the card is shown and
 * treated as a fresh, empty cycle (the next stamp writes the reset to the database, see addStamp).
 */
export function effectiveCard<T extends CardLike>(card: T, now = new Date()): T {
  if (!isCardExpired(card, now)) return card;
  return { ...card, stamps: 0, stage: 'STAGE_1', reward1ClaimedAt: null, reward2ClaimedAt: null, firstStampAt: null };
}

export function getCycleState(rawCard: CardLike, now = new Date()): CycleState {
  const previousCycleExpired = isCardExpired(rawCard, now);
  const card = effectiveCard(rawCard, now);
  const windowDays = stampWindowDays();
  const expiresAt = computeExpiresAt(card.firstStampAt, windowDays);
  const isExpired = false; // an expired cycle has already been replaced by a fresh one above
  const daysRemaining = expiresAt
    ? Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
    : null;

  if (card.stage === 'COMPLETED') {
    return {
      stage: 'COMPLETED',
      stamps: card.stamps,
      goal: STAGE_2_GOAL,
      rewardReady: false,
      rewardType: null,
      isExpired: false,
      previousCycleExpired,
      expiresAt,
      daysRemaining: null,
      programTitle: '¡Ciclo completado!',
      programSub: 'Gracias por tu lealtad',
      progressText: 'Pide al staff reiniciar tu ciclo',
      stampsLabel: `${STAGE_2_GOAL}/${STAGE_2_GOAL}`,
    };
  }

  if (card.stage === 'STAGE_2') {
    const rewardReady = !isExpired && card.stamps >= STAGE_2_GOAL;
    return {
      stage: 'STAGE_2',
      stamps: card.stamps,
      goal: STAGE_2_GOAL,
      rewardReady,
      rewardType: 'SHAKER',
      isExpired,
      previousCycleExpired,
      expiresAt,
      daysRemaining,
      programTitle: 'Camino al Shaker',
      programSub: 'Compra 15 protein shakes y recibe 1 shaker',
      progressText: rewardReady ? '¡Shaker disponible!' : `${STAGE_2_GOAL - card.stamps} para tu shaker`,
      stampsLabel: `${card.stamps}/${STAGE_2_GOAL}`,
    };
  }

  // STAGE_1
  const rewardReady = !isExpired && card.stamps >= STAGE_1_GOAL;
  return {
    stage: 'STAGE_1',
    stamps: card.stamps,
    goal: STAGE_1_GOAL,
    rewardReady,
    rewardType: 'FREE_SHAKE',
    isExpired,
    previousCycleExpired,
    expiresAt,
    daysRemaining,
    programTitle: 'Protein Shake Rewards',
    programSub: 'Compra 6 y el 7° es gratis',
    progressText: rewardReady
      ? '¡Premio disponible!'
      : previousCycleExpired
        ? `Tus sellos vencieron: ciclo nuevo, ${STAGE_1_GOAL} para tu shake gratis`
        : `${STAGE_1_GOAL - card.stamps} para tu shake gratis`,
    stampsLabel: `${card.stamps}/${STAGE_1_GOAL}`,
  };
}

export type StampRejectionReason = 'COMPLETED' | 'EXPIRED' | 'REWARD_PENDING';

export function canAddStamp(card: CardLike, now = new Date()): { ok: true } | { ok: false; reason: StampRejectionReason } {
  if (isCardExpired(card, now)) return { ok: true }; // starts a new cycle (see addStamp)
  if (card.stage === 'COMPLETED') return { ok: false, reason: 'COMPLETED' };
  const state = getCycleState(card, now);
  if (state.rewardReady) return { ok: false, reason: 'REWARD_PENDING' };
  return { ok: true };
}

export type RedeemRejectionReason = 'COMPLETED' | 'EXPIRED' | 'NOT_READY';

export function canRedeem(card: CardLike, now = new Date()): { ok: true } | { ok: false; reason: RedeemRejectionReason } {
  if (card.stage === 'COMPLETED') return { ok: false, reason: 'COMPLETED' };
  if (isCardExpired(card, now)) return { ok: false, reason: 'EXPIRED' };
  const state = getCycleState(card, now);
  if (!state.rewardReady) return { ok: false, reason: 'NOT_READY' };
  return { ok: true };
}

/** Builds the circle-grid representation used by the card view / pass preview (mirrors buildTierInfo in the prototype). */
export function buildCircles(rawCard: CardLike): Array<{ key: string; label: string; filled: boolean; kind: 'stamp' | 'reward' }> {
  const card = effectiveCard(rawCard);
  const state = getCycleState(card);
  if (state.stage === 'COMPLETED') return [];
  if (state.stage === 'STAGE_1') {
    const circles: Array<{ key: string; label: string; filled: boolean; kind: 'stamp' | 'reward' }> = [];
    for (let i = 1; i <= STAGE_1_GOAL; i++) {
      circles.push({ key: String(i), label: String(i), filled: i <= card.stamps, kind: 'stamp' });
    }
    circles.push({ key: 'gratis', label: 'GRATIS', filled: card.stamps >= STAGE_1_GOAL, kind: 'reward' });
    return circles;
  }
  // STAGE_2
  const circles: Array<{ key: string; label: string; filled: boolean; kind: 'stamp' | 'reward' }> = [];
  for (let n = STAGE_1_GOAL; n <= STAGE_2_GOAL; n++) {
    circles.push({ key: String(n), label: String(n), filled: n <= card.stamps, kind: 'stamp' });
  }
  circles.push({ key: 'shaker', label: 'SHAKER', filled: card.stamps >= STAGE_2_GOAL, kind: 'reward' });
  return circles;
}
