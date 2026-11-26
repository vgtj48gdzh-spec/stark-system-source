import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateWorkOrderMaterialDto } from './create-work-order-material.dto';

export class UpdateWorkOrderMaterialDto extends PartialType(
  OmitType(CreateWorkOrderMaterialDto, ['requestIdempotencyKey'] as const),
) {}
