import { config } from 'dotenv';

// E2E runs against a real database — the point is to exercise the constraints,
// transactions and cascades that a mocked repository would hide.
config({ path: '.env.test' });

jest.setTimeout(30_000);
