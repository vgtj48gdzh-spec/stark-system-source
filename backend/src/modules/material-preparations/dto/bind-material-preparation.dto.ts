import { IsInt, Min } from 'class-validator';

export class BindMaterialPreparationDto {
  @IsInt()
  @Min(1)
  workOrderId!: number;
}
