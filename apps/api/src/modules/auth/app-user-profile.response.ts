import { ApiProperty } from '@nestjs/swagger';
import type { AppUserProfile } from '@knowledge-assistant/contracts';

export class AppUserProfileResponse implements AppUserProfile {
  @ApiProperty({
    type: String,
    format: 'uuid',
    example: 'a1234567-1234-4123-8123-123456789abc',
  })
  id!: string;

  @ApiProperty({ type: String, format: 'email', example: 'user@example.test' })
  email!: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-01-02T03:04:05.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-01-03T04:05:06.000Z',
  })
  updatedAt!: string;
}
