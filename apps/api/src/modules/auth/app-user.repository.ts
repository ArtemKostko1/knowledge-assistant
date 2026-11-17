import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { OnModuleDestroy } from '@nestjs/common';
import { createDatabase } from '@knowledge-assistant/database';
import { AuthConfig } from './config/auth.config.js';

@Injectable()
export class AppUserRepository implements OnModuleDestroy {
  private readonly db;
  constructor(config: AuthConfig) {
    this.db = createDatabase(config.databaseUrl);
  }
  async upsert(id: string, email: string) {
    try {
      // Single native PostgreSQL upsert on the UUID PK, not a read/create race.
      return await this.db.appUser.upsert({
        where: { id },
        create: { id, email },
        update: { email },
      });
    } catch {
      throw new ServiceUnavailableException('User store unavailable');
    }
  }
  async find(id: string) {
    try {
      return await this.db.appUser.findUnique({ where: { id } });
    } catch {
      throw new ServiceUnavailableException('User store unavailable');
    }
  }
  async onModuleDestroy(): Promise<void> {
    await this.db.$disconnect();
  }
}
