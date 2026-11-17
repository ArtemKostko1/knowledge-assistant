import { ExpressAdapter } from '@nestjs/platform-express';

export class SafeExpressAdapter extends ExpressAdapter {
  override mapException(error: unknown): unknown {
    return error;
  }
}
