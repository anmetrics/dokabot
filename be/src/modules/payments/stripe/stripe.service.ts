import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StripeService {
  private stripe: Stripe;

  constructor(private config: ConfigService) {
    this.stripe = new Stripe(
      'sk_test_51SXHtR1KaWgv5S2eDMAcv0GqjpcI4lLNr61vn5HZYI7wyt1XFmmLlIJDVE4ZH6fEFqXUfV6CqYxUKPl1wLYVtEcM00fVuYCDao',
    );
  }

  async createPaymentIntent(nftId: string, quantity: number, price: number) {
    const amount = Math.round(price * 100 * quantity); // USD to cents
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      metadata: { nftId, quantity },
    });

    return { secret: paymentIntent.client_secret };
  }

  async createCheckoutSession(nftId: string, quantity: number, price: number) {
    const frontendUrl = 'http://localhost:3001';

    const unitAmount = Math.round(price * 100);

    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: `NFT #${nftId}` },
            unit_amount: unitAmount,
          },
          quantity,
        },
      ],
      mode: 'payment',
      success_url: `${frontendUrl}/success?session_id={CHECKOUT_SESSION_ID}`, // phải có http/https
      cancel_url: `${frontendUrl}/cancel`, // phải có http/https
      metadata: { nftId },
    });

    return { url: session.url };
  }

  async createSubscriptionSession(customerEmail: string, priceId: string) {
    // frontend sẽ redirect sang đây
    const session = await this.stripe.checkout.sessions.create({
      customer_email: customerEmail, // optional
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${this.config.get('FRONTEND_URL')}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${this.config.get('FRONTEND_URL')}/cancel`,
    });

    return { url: session.url };
  }

  async createSubcriptionPrice(
    name: string,
    amount: number,
    interval: 'month' | 'day' | 'year',
  ) {
    // Tạo Product
    const product = await this.stripe.products.create({
      name: 'test',
    });

    // Tạo Price (amount tính bằng cents)
    const price = await this.stripe.prices.create({
      product: product.id,
      unit_amount: Number(amount) * 100,
      currency: 'usd',
      recurring: interval ? { interval } : undefined,
    });

    return { productId: product.id, priceId: price.id };
  }

  async cancelSubscription(subscriptionId: string) {
    try {
      const deleted = await this.stripe.subscriptions.cancel(subscriptionId);
      return deleted;
    } catch (error) {
      console.error('Cancel subscription error:', error);
      throw error;
    }
  }

  constructWebhookEvent(
    rawBody: Buffer,
    signature: string,
    endpointSecret: string,
  ) {
    return this.stripe.webhooks.constructEvent(
      rawBody,
      signature,
      endpointSecret,
    );
  }
}
