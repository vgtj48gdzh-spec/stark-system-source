import { Body, Controller, Post } from '@nestjs/common';
import { CurrentUserDecorator } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { RawImportSmsMessageDto } from './dto/raw-import-sms-message.dto';
import { MessageHubService } from './message-hub.service';

@Controller('message-hub')
export class MessageHubController {
  constructor(private readonly messageHubService: MessageHubService) {}

  @Post('raw-import')
  @Roles('owner', 'super_admin')
  async rawImport(
    @Body() dto: RawImportSmsMessageDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    const result = await this.messageHubService.importRawMessage(
      {
        sender: dto.sender,
        body: dto.body,
        receivedAt: new Date(dto.receivedAt),
        source: dto.source,
      },
      currentUser,
    );

    return {
      success: true,
      data: {
        rawSmsId: result.raw.id,
        deduplicated: result.deduplicated,
        classifyType: result.classification?.classifyType ?? 'other',
        classification: result.classification?.parsedJson ?? null,
        downstreamSummary: result.downstreamSummary,
      },
      message: 'Raw SMS imported successfully.',
    };
  }
}
