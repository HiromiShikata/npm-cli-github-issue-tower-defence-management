import { WebhookRepository } from '../../domain/usecases/adapter-interfaces/WebhookRepository';

export class FetchWebhookRepository implements WebhookRepository {
  async sendGetRequest(url: string): Promise<void> {
    await fetch(url);
  }
}
