import { Controller, Get } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiOperation,
  ApiPayloadTooLargeResponse,
  ApiUnsupportedMediaTypeResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  ApiErrorResponseDto,
  apiErrorResponseHeaders,
} from '../../common/http/api-error.response.js';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({
    summary: 'Check API process health',
    description:
      'Returns the process-level health status. It does not check database or Supabase readiness.',
  })
  @ApiOkResponse({
    description: 'The API process is healthy.',
    headers: apiErrorResponseHeaders,
    schema: {
      type: 'object',
      required: ['status'],
      properties: {
        status: { type: 'string', enum: ['ok'], example: 'ok' },
      },
    },
  })
  @ApiInternalServerErrorResponse({
    description: 'An unexpected server error occurred.',
    headers: apiErrorResponseHeaders,
    type: ApiErrorResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'The request body could not be parsed.',
    headers: apiErrorResponseHeaders,
    type: ApiErrorResponseDto,
  })
  @ApiUnsupportedMediaTypeResponse({
    description: 'The request body charset or encoding is unsupported.',
    headers: apiErrorResponseHeaders,
    type: ApiErrorResponseDto,
  })
  @ApiPayloadTooLargeResponse({
    description: 'The request body exceeds the parser limit.',
    headers: apiErrorResponseHeaders,
    type: ApiErrorResponseDto,
  })
  status(): { status: string } {
    return { status: 'ok' };
  }
}
