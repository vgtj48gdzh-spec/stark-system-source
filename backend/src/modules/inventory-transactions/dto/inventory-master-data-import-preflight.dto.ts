import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

const SOURCE_REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,63}$/;

class MasterDataSourceRefDto {
  @IsString()
  @Matches(SOURCE_REF_PATTERN)
  sourceRef!: string;
}

export class WarehouseImportPreviewRowDto extends MasterDataSourceRefDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;
}

export class SupplierImportPreviewRowDto extends MasterDataSourceRefDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;
}

export class MaterialImportPreviewRowDto extends MasterDataSourceRefDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  specification?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  unit!: string;

  @IsOptional()
  @IsString()
  @Matches(SOURCE_REF_PATTERN)
  defaultSupplierRef?: string;
}

export class OpeningStockImportPreviewRowDto {
  @IsString()
  @Matches(SOURCE_REF_PATTERN)
  warehouseRef!: string;

  @IsString()
  @Matches(SOURCE_REF_PATTERN)
  materialRef!: string;

  @IsNumberString({}, { message: '期初数量格式错误' })
  quantity!: string;

  @IsNumberString({}, { message: '期初单价格式错误' })
  unitPrice!: string;
}

export class InventoryMasterDataImportPreflightDto {
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => WarehouseImportPreviewRowDto)
  warehouses!: WarehouseImportPreviewRowDto[];

  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => SupplierImportPreviewRowDto)
  suppliers!: SupplierImportPreviewRowDto[];

  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => MaterialImportPreviewRowDto)
  materials!: MaterialImportPreviewRowDto[];

  @IsArray()
  @ArrayMaxSize(2000)
  @ValidateNested({ each: true })
  @Type(() => OpeningStockImportPreviewRowDto)
  openingStocks!: OpeningStockImportPreviewRowDto[];
}
