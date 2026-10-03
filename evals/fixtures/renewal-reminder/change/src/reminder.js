/** Formats the amount of a charge in cents as a display string. */
export function formatAmount(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

/** Key used to deduplicate reminders for one subscription. */
export function reminderKey(subscriptionId, detectedAt) {
  const period = detectedAt.toISOString().slice(0, 7);
  return `${subscriptionId}:${period}`;
}

/** Builds the webhook request that sends one renewal reminder. */
export function buildReminderRequest(config, subscription, detectedAt) {
  return {
    url: config.webhookUrl,
    body: {
      key: reminderKey(subscription.id, detectedAt),
      email: subscription.email,
      amount: formatAmount(subscription.amountCents),
      next_charge_at: subscription.nextChargeAt ?? new Date().toISOString(),
    },
  };
}
