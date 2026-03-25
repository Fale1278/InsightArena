import {
  Injectable,
  NotFoundException,
  BadGatewayException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Market } from './entities/market.entity';
import { CreateMarketDto } from './dto/create-market.dto';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';

@Injectable()
export class MarketsService {
  private readonly logger = new Logger(MarketsService.name);

  constructor(
    @InjectRepository(Market)
    private readonly marketsRepository: Repository<Market>,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Create a new market: call Soroban contract, then persist to DB.
   * Rolls back the DB write if the Soroban call fails.
   */
  async create(dto: CreateMarketDto, user: User): Promise<Market> {
    // Step 1: Call Soroban contract to create market on-chain
    let onChainMarketId: string;
    try {
      // TODO: Replace with real SorobanService.createMarket() call
      // For now generate a placeholder on-chain ID
      onChainMarketId = `market_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      this.logger.log(
        `Soroban createMarket called for "${dto.title}" — on_chain_id: ${onChainMarketId}`,
      );
    } catch (err) {
      this.logger.error('Soroban createMarket failed', err);
      throw new BadGatewayException('Failed to create market on Soroban');
    }

    // Step 2: Persist to database
    try {
      const market = this.marketsRepository.create({
        on_chain_market_id: onChainMarketId,
        creator: user,
        title: dto.title,
        description: dto.description,
        category: dto.category,
        outcome_options: dto.outcome_options,
        end_time: new Date(dto.end_time),
        resolution_time: new Date(dto.resolution_time),
        is_public: dto.is_public,
        is_resolved: false,
        is_cancelled: false,
        total_pool_stroops: '0',
        participant_count: 0,
      });

      return await this.marketsRepository.save(market);
    } catch (err) {
      this.logger.error('Failed to save market to DB after Soroban success', err);
      // TODO: Compensate on-chain (cancel the market) if DB write fails
      throw new BadGatewayException(
        'Market created on-chain but failed to save to database',
      );
    }
  }

  async findAll(): Promise<Market[]> {
    return this.marketsRepository.find({
      relations: ['creator'],
    });
  }

  async findById(id: string): Promise<Market> {
    // Try UUID first, then on_chain_market_id
    const market = await this.marketsRepository.findOne({
      where: [{ id }, { on_chain_market_id: id }],
      relations: ['creator'],
    });

    if (!market) {
      throw new NotFoundException(`Market with ID "${id}" not found`);
    }

    return market;
  }
}
