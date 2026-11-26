import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

const refPattern = /^[a-z0-9][a-z0-9_-]{7,99}$/i;

export class CreateBusinessCompanyRefDto {
  @IsInt()
  @Min(1)
  companyRegistryId!: number;

  @IsDateString()
  validFrom!: string;

  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  evidenceRef!: string;
}

export class CreateBusinessSectorDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z][a-z0-9_-]{1,63}$/)
  code!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;
}

export class CreateCompanySectorAssignmentDto {
  @IsString()
  @Matches(refPattern)
  companyRef!: string;

  @IsString()
  @Matches(refPattern)
  businessSectorRef!: string;

  @IsDateString()
  validFrom!: string;

  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  authorizationSource!: string;
}

export class CreateBusinessStoreDto {
  @IsString()
  @Matches(refPattern)
  companyRef!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9][a-z0-9_-]{1,63}$/i)
  code!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @IsDateString()
  validFrom!: string;

  @IsOptional()
  @IsDateString()
  validUntil?: string;
}

export class CreateStoreSectorAssignmentDto {
  @IsString()
  @Matches(refPattern)
  storeRef!: string;

  @IsString()
  @Matches(refPattern)
  businessSectorRef!: string;

  @IsDateString()
  validFrom!: string;

  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  authorizationSource!: string;
}

export class CreateCustomerMasterDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  displayName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  mobileMasked?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  legacyIdentificationBindingId?: number;
}

export class CreateCustomerOrganizationRelationshipDto {
  @IsString()
  @Matches(refPattern)
  customerRef!: string;

  @IsString()
  @Matches(refPattern)
  companyRef!: string;

  @IsOptional()
  @IsString()
  @Matches(refPattern)
  storeRef?: string;

  @IsDateString()
  validFrom!: string;

  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  relationshipSource!: string;
}

export class CreateBusinessScopeGrantDto {
  @IsInt()
  @Min(1)
  userId!: number;

  @IsInt()
  @Min(1)
  employeeId!: number;

  @IsString()
  @Matches(refPattern)
  companyRef!: string;

  @IsOptional()
  @IsString()
  @Matches(refPattern)
  businessSectorRef?: string;

  @IsOptional()
  @IsString()
  @Matches(refPattern)
  storeRef?: string;

  @IsOptional()
  @IsString()
  @Matches(refPattern)
  customerRef?: string;

  @IsIn(['allow', 'deny'])
  effect!: 'allow' | 'deny';

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(64)
  @IsString({ each: true })
  @Matches(/^(\*|[a-z][a-z0-9_.:-]{2,99})$/, { each: true })
  permissions!: string[];

  @IsDateString()
  validFrom!: string;

  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  authorizationSource!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}

export class UpdateBusinessScopeGrantDto {
  @IsIn(['active', 'revoked'])
  status!: 'active' | 'revoked';

  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

export class QueryBusinessCustomersDto {
  @IsString()
  @Matches(refPattern)
  companyRef!: string;

  @IsString()
  @Matches(refPattern)
  businessSectorRef!: string;

  @IsString()
  @Matches(refPattern)
  storeRef!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
