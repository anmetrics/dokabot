import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppService {
  private stripe: Stripe;

  constructor(private config: ConfigService) {}
}
