import { getStripeSync } from './stripe';

export class WebhookHandlers {
    static async processWebhook(payload: Buffer, signature: string, uuid: string): Promise<void> {
        if (!Buffer.isBuffer(payload)) {
            throw new Error(
                'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
                'Received type: ' + typeof payload + '. ' +
                'This usually means the body was parsed before reaching this handler.'
            );
        }

        const sync = await getStripeSync() as { processWebhook: (payload: Buffer, signature: string, uuid: string) => Promise<void> };
        await sync.processWebhook(payload, signature, uuid);
    }
}
