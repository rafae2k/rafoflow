/** One outgoing webhook HTTP request, already serialized and signed. */
export interface OutgoingWebhook {
  url: string;
  headers: Record<string, string>;
  body: string;
}

export type SendResult = { ok: true; status: number } | { ok: false; status: number | null; error: string };

/**
 * Transport for webhook deliveries. The API never opens sockets itself:
 * production wires an HTTP implementation, tests wire a recorder.
 */
export interface WebhookSender {
  send(webhook: OutgoingWebhook): Promise<SendResult>;
}

/** Sender that records every webhook and answers with a fixed result. */
export function createRecordingSender(result: SendResult = { ok: true, status: 200 }): WebhookSender & {
  sent: OutgoingWebhook[];
} {
  const sent: OutgoingWebhook[] = [];
  return {
    sent,
    async send(webhook) {
      sent.push(webhook);
      return result;
    },
  };
}
