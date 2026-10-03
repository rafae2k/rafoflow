import type { Cents } from "../lib/money.ts";

export interface ChargeRequest {
  customerId: string;
  subscriptionId: string;
  amountCents: Cents;
}

export type ChargeResult =
  | { ok: true; reference: string }
  | { ok: false; reason: string };

/**
 * The card processor. Real implementations call out over the network, so
 * `charge` is async; callers must not hold a transaction across it.
 */
export interface PaymentGateway {
  charge(request: ChargeRequest): Promise<ChargeResult>;
}

/** Development gateway that approves every charge. */
export function createApprovingGateway(): PaymentGateway {
  let counter = 0;
  return {
    async charge() {
      counter++;
      return { ok: true, reference: `dev_${counter}` };
    },
  };
}
