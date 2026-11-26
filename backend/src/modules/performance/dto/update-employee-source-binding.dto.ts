import { PartialType } from '@nestjs/mapped-types';
import { CreateEmployeeSourceBindingDto } from './create-employee-source-binding.dto';

export class UpdateEmployeeSourceBindingDto extends PartialType(
  CreateEmployeeSourceBindingDto,
) {}
