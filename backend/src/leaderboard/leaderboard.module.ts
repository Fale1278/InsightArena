import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { LeaderboardEntry } from './entities/leaderboard-entry.entity';
import { UsersModule } from '../users/users.module';
import { LeaderboardService } from './leaderboard.service';
import { LeaderboardScheduler } from './leaderboard.scheduler';
import { LeaderboardController } from './leaderboard.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([LeaderboardEntry]),
    UsersModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [LeaderboardController],
  providers: [LeaderboardService, LeaderboardScheduler],
  exports: [LeaderboardService],
})
export class LeaderboardModule {}
