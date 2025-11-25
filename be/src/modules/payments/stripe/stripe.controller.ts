import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  RawBodyRequest,
  Req,
  Res,
} from '@nestjs/common';
import { StripeService } from './stripe.service';
import Stripe from 'stripe';
import { Request, Response } from 'express';

@Controller('stripe')
export class StripeController {
  constructor(private readonly stripeService: StripeService) {}

  @Get()
  getLog() {}

  @Post('stripe')
  @HttpCode(HttpStatus.OK)
  async createPayment() {
    return this.stripeService.createPaymentIntent('nft_1', 1, 100);
  }

  @Post('checkout')
  @HttpCode(HttpStatus.OK)
  async createCheckout(
    @Body()
    body: {
      price: number;
    },
  ) {
    return this.stripeService.createCheckoutSession(
      'nft_1',
      1,
      Number(body.price),
    );
  }

  @Post('subcription')
  @HttpCode(HttpStatus.OK)
  async createSubcription(
    @Body()
    body: {
      priceId: string;
    },
  ) {
    return this.stripeService.createSubscriptionSession(
      'thientq@paditech.com',
      body.priceId,
    );
  }

  @Post('subcription-price')
  @HttpCode(HttpStatus.OK)
  async createSubcriptionPrice(
    @Body()
    body: {
      name: string;
      amount: number;
      interval?: 'month' | 'day' | 'year';
    },
  ) {
    return this.stripeService.createSubcriptionPrice(
      body.name,
      body.amount,
      body.interval || 'month',
    );
  }

  @Post('cancel-subcription')
  @HttpCode(HttpStatus.OK)
  async cancelSubscription(
    @Body()
    body: {
      subscriptionId: string;
    },
  ) {
    return this.stripeService.cancelSubscription(body.subscriptionId);
  }

  @Post('webhook')
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Res() res: Response,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!req.rawBody) {
      return;
    }
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!endpointSecret) {
      return;
    }

    let event: Stripe.Event;
    try {
      // req.rawBody cần được cấu hình middleware body-parser dạng raw
      event = this.stripeService.constructWebhookEvent(
        req.rawBody,
        signature,
        endpointSecret,
      );
    } catch (err) {
      console.error('Webhook signature verification failed.', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Xử lý các event
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object as Stripe.Checkout.Session;
        // handle buy NFT
        break;

      case 'invoice.payment_succeeded':
        const invoice = event.data.object as Stripe.Invoice;
        // handle buy nft hang thang
        break;

      case 'invoice.payment_failed':
        console.log('Payment failed for invoice', event.data.object);
        break;

      case 'customer.subscription.deleted':
        console.log('Subscription canceled', event.data.object);
        break;
    }

    res.json({ received: true });
  }
}
