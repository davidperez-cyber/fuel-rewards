import type { Customer, LoyaltyCard } from '@prisma/client';
import { buildCircles, getCycleState } from './rules';

export function serializeCustomerWithCard(customer: Customer, card: LoyaltyCard) {
  const state = getCycleState(card);
  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    createdAt: customer.createdAt,
    card: {
      serialNumber: card.serialNumber,
      stamps: card.stamps,
      stage: state.stage,
      goal: state.goal,
      stampsLabel: state.stampsLabel,
      programTitle: state.programTitle,
      programSub: state.programSub,
      progressText: state.progressText,
      rewardReady: state.rewardReady,
      rewardType: state.rewardType,
      isExpired: state.isExpired,
      expiresAt: state.expiresAt,
      daysRemaining: state.daysRemaining,
      cycleNumber: card.cycleNumber,
      circles: buildCircles(card),
      reward1ClaimedAt: card.reward1ClaimedAt,
      reward2ClaimedAt: card.reward2ClaimedAt,
      googleObjectId: card.googleObjectId,
      walletToken: card.authenticationToken,
      cardUrl: `/wallet/${card.serialNumber}?t=${card.authenticationToken}`,
      appleWalletUrl: `/api/wallet/apple/${card.serialNumber}?t=${card.authenticationToken}`,
      googleWalletUrl: `/api/wallet/google/${card.serialNumber}?t=${card.authenticationToken}`,
    },
  };
}
