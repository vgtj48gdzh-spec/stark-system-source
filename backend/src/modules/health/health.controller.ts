import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @Public()
  async getHealth() {
    return {
      success: true,
      message: '查询成功',
      data: await this.healthService.getHealth(),
    };
  }
}
