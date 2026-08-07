import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  /** Root ping. Real probes live under /api/health. */
  @Get()
  root() {
    return { name: 'dokabot-api', docs: '/api/health' };
  }
}
