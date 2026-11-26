import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SourceSystemStatus } from '../../shared/enums/source-system-status.enum';
import { SourceSystem } from './entities/source-system.entity';

interface EnsureSourceSystemInput {
  sourceSystemCode: string;
  name: string;
  syncScope?: string[];
}

@Injectable()
export class SourceSystemsService {
  constructor(
    @InjectRepository(SourceSystem)
    private readonly sourceSystemRepository: Repository<SourceSystem>,
  ) {}

  async ensureSourceSystem(input: EnsureSourceSystemInput) {
    const existing = await this.sourceSystemRepository.findOne({
      where: { sourceSystemCode: input.sourceSystemCode },
    });

    if (existing) {
      existing.name = input.name;
      existing.status = SourceSystemStatus.ACTIVE;
      existing.syncScope = input.syncScope?.length ? input.syncScope : existing.syncScope;
      return this.sourceSystemRepository.save(existing);
    }

    const sourceSystem = this.sourceSystemRepository.create({
      sourceSystemCode: input.sourceSystemCode,
      name: input.name,
      status: SourceSystemStatus.ACTIVE,
      syncScope: input.syncScope ?? null,
    });

    return this.sourceSystemRepository.save(sourceSystem);
  }

  async touchLastSyncedAt(sourceSystemId: number, syncedAt: Date) {
    await this.sourceSystemRepository.update(sourceSystemId, { lastSyncedAt: syncedAt });
  }
}
