import {
  IsString,
  IsBoolean,
  IsEnum,
  IsArray,
  IsDateString,
  IsNumberString,
  IsNumber,
  MinLength,
  MaxLength,
  ArrayMinSize,
  ArrayMaxSize,
  Min,
  Max,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum MarketCategory {
  Crypto = 'Crypto',
  Sports = 'Sports',
  Finance = 'Finance',
  Politics = 'Politics',
  Tech = 'Tech',
}

// ── Custom Validators ────────────────────────────────────────────────────────

@ValidatorConstraint({ name: 'isFutureDate', async: false })
export class IsFutureDateConstraint implements ValidatorConstraintInterface {
  validate(value: string) {
    return new Date(value) > new Date();
  }

  defaultMessage() {
    return 'end_time must be a date in the future';
  }
}

@ValidatorConstraint({ name: 'isAfterEndTime', async: false })
export class IsAfterEndTimeConstraint implements ValidatorConstraintInterface {
  validate(value: string, args: ValidationArguments) {
    const obj = args.object as CreateMarketDto;
    if (!obj.end_time || !value) return false;
    return new Date(value) >= new Date(obj.end_time);
  }

  defaultMessage() {
    return 'resolution_time must be >= end_time';
  }
}

// ── DTO ──────────────────────────────────────────────────────────────────────

export class CreateMarketDto {
  @ApiProperty({
    description: 'Market title',
    example: 'Will BTC reach $100k by end of 2026?',
    minLength: 5,
    maxLength: 200,
  })
  @IsString()
  @MinLength(5)
  @MaxLength(200)
  title: string;

  @ApiProperty({
    description: 'Detailed market description',
    example: 'This market resolves YES if Bitcoin reaches $100,000 USD...',
    minLength: 10,
    maxLength: 2000,
  })
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  description: string;

  @ApiProperty({
    description: 'Market category',
    enum: MarketCategory,
    example: MarketCategory.Crypto,
  })
  @IsEnum(MarketCategory)
  category: MarketCategory;

  @ApiProperty({
    description: 'Possible outcomes',
    example: ['Yes', 'No'],
    minItems: 2,
    maxItems: 10,
  })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(2)
  @ArrayMaxSize(10)
  outcome_options: string[];

  @ApiProperty({
    description: 'Market end time (must be in the future)',
    example: '2026-12-31T23:59:59.000Z',
  })
  @IsDateString()
  @Validate(IsFutureDateConstraint)
  end_time: string;

  @ApiProperty({
    description: 'Resolution time (must be >= end_time)',
    example: '2027-01-07T23:59:59.000Z',
  })
  @IsDateString()
  @Validate(IsAfterEndTimeConstraint)
  resolution_time: string;

  @ApiProperty({
    description: 'Creator fee in basis points (0-500)',
    example: 100,
    minimum: 0,
    maximum: 500,
  })
  @IsNumber()
  @Min(0)
  @Max(500)
  creator_fee_bps: number;

  @ApiProperty({
    description: 'Minimum stake in stroops',
    example: '10000000',
  })
  @IsNumberString()
  min_stake_stroops: string;

  @ApiProperty({
    description: 'Maximum stake in stroops',
    example: '1000000000',
  })
  @IsNumberString()
  max_stake_stroops: string;

  @ApiProperty({
    description: 'Whether the market is publicly visible',
    example: true,
  })
  @IsBoolean()
  is_public: boolean;
}
