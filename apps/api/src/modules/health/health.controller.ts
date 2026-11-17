import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

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
    schema: {
      type: 'object',
      required: ['status'],
      properties: {
        status: { type: 'string', enum: ['ok'], example: 'ok' },
      },
    },
  })
  status(): { status: string } {
    return { status: 'ok' };
  }
}
