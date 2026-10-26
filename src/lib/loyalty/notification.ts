import { STAGE_1_GOAL, STAGE_2_GOAL, getCycleState, type CardLike } from './rules';

/**
 * The text the customer's phone shows when their card changes (Apple Wallet `changeMessage` and a
 * Google Wallet message with notification). It is derived only from the card's current state, so the
 * Apple pass can rebuild it whenever Wallet asks for the updated pass: the text changes whenever the
 * card does, which is what makes Wallet raise the notification.
 */
export function walletNotificationText(card: CardLike & { cycleNumber?: number }): string {
  const s = getCycleState(card);

  if (s.stage === 'COMPLETED') return '¡Ciclo completado! Gracias por ser parte de UFC GYM FUEL.';
  if (s.isExpired) return 'Tus sellos vencieron. Pide al staff reiniciar tu ciclo.';

  if (s.stage === 'STAGE_1') {
    if (s.stamps === 0) {
      return (card.cycleNumber ?? 1) > 1
        ? 'Tu tarjeta se reinició. ¡Empieza un nuevo ciclo!'
        : 'Tu tarjeta está lista. ¡Suma un sello con cada Protein Shake!';
    }
    if (s.rewardReady) return '¡Ya tienes tu shake gratis! Canjéalo en caja.';
    const left = STAGE_1_GOAL - s.stamps;
    return `¡Sello agregado! Llevas ${s.stampsLabel}. ${left === 1 ? 'Te falta 1 para tu shake gratis' : `Te faltan ${left} para tu shake gratis`}.`;
  }

  // STAGE_2 (stamps keep counting from 6 up to 14)
  if (s.rewardReady) return '¡Ya tienes tu shaker de regalo! Pídelo en caja.';
  if (s.stamps === STAGE_1_GOAL) return 'Canjeaste tu shake gratis. ¡Sigue sumando para tu shaker!';
  const left = STAGE_2_GOAL - s.stamps;
  return `¡Sello agregado! Llevas ${s.stampsLabel}. ${left === 1 ? 'Te falta 1 para tu shaker' : `Te faltan ${left} para tu shaker`}.`;
}
