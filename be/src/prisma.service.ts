// import { INestApplication, Injectable, OnModuleInit } from '@nestjs/common';
// import {} from '@prisma/client';

// @Injectable()
// export class PrismaService extends PrismaClient implements OnModuleInit {
//   constructor() {
//     super();
//   }
//   async onModuleInit() {
//     await this.$connect();
//   }

//   // eslint-disable-next-line @typescript-eslint/require-await
//   async enableShutdownHooks(app: INestApplication) {
//     // eslint-disable-next-line @typescript-eslint/no-misused-promises
//     process.on('beforeExit', async () => {
//       await app.close();
//     });
//   }
// }
