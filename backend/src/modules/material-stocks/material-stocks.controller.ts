import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { QueryMaterialStocksDto } from './dto/query-material-stocks.dto';
import { MaterialStocksService } from './material-stocks.service';

@Controller('material-stocks')
export class MaterialStocksController {
  constructor(private readonly materialStocksService: MaterialStocksService) {}

  @Get()
  @Roles('operator', 'finance')
  async findAll(@Query() query: QueryMaterialStocksDto) {
    return {
      success: true,
      message: '查询成功',
      data: await this.materialStocksService.findAll(query.warehouseId, query.materialId),
    };
  }
}
