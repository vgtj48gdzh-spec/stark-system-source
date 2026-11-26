import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUserDecorator } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RequireFormalActorIdentity } from '../../common/decorators/require-formal-actor-identity.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import {
  ControlHomeClimateDeviceDto,
  CreateHomeClimatePresetDto,
  ListHomeClimateControlLogsDto,
  LobsterHomeClimateContextControlDto,
  LobsterHomeClimateControlDto,
  RegisterHomeClimateDeviceDto,
  UpdateHomeClimateDeviceDto,
  UpdateHomeClimatePresetDto,
} from './dto/home-climate.dto';
import { HomeClimateService } from './home-climate.service';

@Controller('home-climate')
export class HomeClimateController {
  constructor(private readonly homeClimateService: HomeClimateService) {}

  @Get('devices')
  @Roles('admin', 'owner')
  listDevices() {
    return this.wrap('查询成功', this.homeClimateService.listDevices());
  }

  @Post('devices')
  @Roles('admin', 'owner')
  @RequireFormalActorIdentity()
  registerDevice(
    @Body() dto: RegisterHomeClimateDeviceDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap('设备已登记', this.homeClimateService.registerDevice(dto, currentUser));
  }

  @Patch('devices/:deviceId')
  @Roles('admin', 'owner')
  @RequireFormalActorIdentity()
  updateDevice(
    @Param('deviceId', ParseIntPipe) deviceId: number,
    @Body() dto: UpdateHomeClimateDeviceDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap(
      '设备已更新',
      this.homeClimateService.updateDevice(deviceId, dto, currentUser),
    );
  }

  @Get('devices/:deviceId/state')
  @Roles('admin', 'owner')
  readState(
    @Param('deviceId', ParseIntPipe) deviceId: number,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap('状态已读取', this.homeClimateService.readState(deviceId, currentUser));
  }

  @Get('devices/:deviceId/presets')
  @Roles('admin', 'owner')
  listPresets(@Param('deviceId', ParseIntPipe) deviceId: number) {
    return this.wrap('查询成功', this.homeClimateService.listPresets(deviceId));
  }

  @Post('devices/:deviceId/presets')
  @Roles('admin', 'owner')
  @RequireFormalActorIdentity()
  createPreset(
    @Param('deviceId', ParseIntPipe) deviceId: number,
    @Body() dto: CreateHomeClimatePresetDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap(
      '预设已创建',
      this.homeClimateService.createPreset(deviceId, dto, currentUser),
    );
  }

  @Patch('presets/:presetId')
  @Roles('admin', 'owner')
  @RequireFormalActorIdentity()
  updatePreset(
    @Param('presetId', ParseIntPipe) presetId: number,
    @Body() dto: UpdateHomeClimatePresetDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap(
      '预设已更新',
      this.homeClimateService.updatePreset(presetId, dto, currentUser),
    );
  }

  @Post('devices/:deviceId/control')
  @Roles('owner')
  @RequireFormalActorIdentity()
  controlFromWeb(
    @Param('deviceId', ParseIntPipe) deviceId: number,
    @Body() dto: ControlHomeClimateDeviceDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.wrap(
      '控制请求已处理',
      this.homeClimateService.controlFromWeb(deviceId, dto, currentUser),
    );
  }

  @Get('control-logs')
  @Roles('admin', 'owner')
  listControlLogs(@Query() query: ListHomeClimateControlLogsDto) {
    return this.wrap('查询成功', this.homeClimateService.listControlLogs(query));
  }

  @Public()
  @Post('lobster/control')
  lobsterControl(
    @Body() dto: LobsterHomeClimateControlDto,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    return this.wrap('控制请求已处理', this.homeClimateService.controlFromLobster(dto, headers));
  }

  @Public()
  @Post('lobster/context-control')
  lobsterContextControl(
    @Body() dto: LobsterHomeClimateContextControlDto,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    return this.wrap(
      '控制请求已处理',
      this.homeClimateService.controlFromLobsterContext(dto, headers),
    );
  }

  private async wrap(message: string, dataPromise: Promise<unknown>) {
    return { success: true, message, data: await dataPromise };
  }
}
