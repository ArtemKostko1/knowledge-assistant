import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  API_ERROR_CODES,
  API_ERROR_TYPES,
  VALIDATION_DETAIL_CODES,
} from './api-error.js';

export class ApiValidationErrorDetailResponse {
  @ApiProperty({
    description: 'Safe field path; submitted values are never included.',
    example: 'email',
  })
  field!: string;

  @ApiProperty({ enum: VALIDATION_DETAIL_CODES, example: 'INVALID_FORMAT' })
  code!: (typeof VALIDATION_DETAIL_CODES)[number];
}

export class ApiErrorBodyResponse {
  @ApiProperty({ enum: API_ERROR_TYPES, example: 'AuthenticationError' })
  type!: (typeof API_ERROR_TYPES)[number];

  @ApiProperty({ enum: API_ERROR_CODES, example: 'AUTH_UNAUTHORIZED' })
  code!: (typeof API_ERROR_CODES)[number];

  @ApiProperty({ example: 'Authentication is required' })
  message!: string;

  @ApiPropertyOptional({ type: [ApiValidationErrorDetailResponse] })
  details?: ApiValidationErrorDetailResponse[];
}

export class ApiErrorResponseDto {
  @ApiProperty({
    type: 'integer',
    example: 401,
    minimum: 400,
    maximum: 599,
  })
  statusCode!: number;

  @ApiProperty({ type: ApiErrorBodyResponse })
  error!: ApiErrorBodyResponse;

  @ApiProperty({
    format: 'uuid',
    example: 'd4b519cf-7284-4ae9-a882-3c337a25ef22',
  })
  requestId!: string;

  @ApiProperty({
    format: 'date-time',
    example: '2026-11-17T12:00:00.000Z',
  })
  timestamp!: string;

  @ApiPropertyOptional({
    description: 'Safe route template, without query or dynamic values.',
    example: '/auth/me',
  })
  path?: string;
}

export const apiErrorResponseHeaders = {
  'X-Request-ID': {
    description: 'Server-generated request correlation ID.',
    schema: { type: 'string', format: 'uuid' },
  },
} as const;
