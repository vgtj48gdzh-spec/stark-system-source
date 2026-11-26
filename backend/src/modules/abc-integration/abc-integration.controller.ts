import { Body, Controller, Post } from '@nestjs/common';
import { CurrentUserDecorator } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { AbcIntegrationService } from './abc-integration.service';
import { ManualImportAbcRawDto } from './dto/manual-import-abc-raw.dto';
import { ManualNormalizeAbcSyncDto } from './dto/manual-normalize-abc-sync.dto';

@Controller('abc-integration')
export class AbcIntegrationController {
  constructor(private readonly abcIntegrationService: AbcIntegrationService) {}

  @Post('manual-imports')
  @Roles('admin')
  async manualImport(
    @Body() dto: ManualImportAbcRawDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: 'ABC 离线原始导入成功',
      data: await this.abcIntegrationService.runManualImport(dto, currentUser),
    };
  }

  @Post('manual-normalizations')
  @Roles('admin')
  async manualNormalization(
    @Body() dto: ManualNormalizeAbcSyncDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: 'ABC sync normalization completed successfully',
      data: await this.abcIntegrationService.runManualNormalization(dto, currentUser),
    };
  }
}
