import { PartialType } from '@nestjs/mapped-types';
import { CreatePlatformConnectorConfigDto } from './create-platform-connector-config.dto';

export class UpdatePlatformConnectorConfigDto extends PartialType(CreatePlatformConnectorConfigDto) {}
