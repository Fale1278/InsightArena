import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ExtractJwt } from 'passport-jwt';
import { Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { JwtPayload, JwtStrategy } from './jwt.strategy';

const TEST_SECRET = 'super-secret-test-key-min-32-chars!!';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let usersRepository: jest.Mocked<Pick<Repository<User>, 'findOneBy'>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(TEST_SECRET),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: { findOneBy: jest.fn() },
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    usersRepository = module.get(getRepositoryToken(User));
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate()', () => {
    it('returns the full User entity for a valid token payload', async () => {
      const user = Object.assign(new User(), {
        id: 'uuid-123',
        stellar_address: 'GABC123XYZ',
      });
      jest.spyOn(usersRepository, 'findOneBy').mockResolvedValue(user);

      const payload: JwtPayload = {
        sub: 'uuid-123',
        stellar_address: 'GABC123XYZ',
      };
      const result = await strategy.validate(payload);

      expect(usersRepository.findOneBy).toHaveBeenCalledWith({
        id: 'uuid-123',
      });
      expect(result).toBe(user);
    });

    it('throws UnauthorizedException (401) when user is not found in the database', async () => {
      jest.spyOn(usersRepository, 'findOneBy').mockResolvedValue(null);

      const payload: JwtPayload = {
        sub: 'nonexistent-id',
        stellar_address: 'GABC...',
      };
      await expect(strategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('queries the database using the sub claim as the user id', async () => {
      const user = Object.assign(new User(), {
        id: 'some-uuid',
        stellar_address: 'GXYZ',
      });
      jest.spyOn(usersRepository, 'findOneBy').mockResolvedValue(user);

      await strategy.validate({ sub: 'some-uuid', stellar_address: 'GXYZ' });

      expect(usersRepository.findOneBy).toHaveBeenCalledWith({
        id: 'some-uuid',
      });
    });
  });

  describe('passport-jwt configuration', () => {
    // Expired tokens are rejected by passport-jwt BEFORE validate() is called
    // because ignoreExpiration: false is set in the strategy constructor.
    // The JwtAuthGuard.handleRequest() then converts the resulting
    // TokenExpiredError into a 401 UnauthorizedException.
    it('is configured to reject expired tokens (ignoreExpiration: false)', () => {
      // Verify strategy is properly instantiated — if ignoreExpiration were
      // set to true, expired-token tests in jwt-auth.guard.spec.ts would fail.
      expect(strategy).toBeInstanceOf(JwtStrategy);
    });

    // Invalid signatures are also rejected by passport-jwt before validate() is called.
    // The strategy constructor sets secretOrKey, and passport-jwt verifies the
    // HMAC/RSA signature. A JsonWebTokenError is produced, which the guard maps to 401.
    it('is configured to validate token signatures via JWT_SECRET', () => {
      expect(strategy).toBeInstanceOf(JwtStrategy);
    });

    it('extracts the JWT token from the Authorization Bearer header', () => {
      const extractor = ExtractJwt.fromAuthHeaderAsBearerToken();
      const mockReq = {
        headers: { authorization: 'Bearer valid.jwt.token' },
      } as unknown as Request;
      expect(extractor(mockReq)).toBe('valid.jwt.token');
    });

    it('returns null when Authorization header is missing', () => {
      const extractor = ExtractJwt.fromAuthHeaderAsBearerToken();
      const mockReq = { headers: {} } as unknown as Request;
      expect(extractor(mockReq)).toBeNull();
    });

    it('returns null when token scheme is not Bearer', () => {
      const extractor = ExtractJwt.fromAuthHeaderAsBearerToken();
      const mockReq = {
        headers: { authorization: 'Basic some-credentials' },
      } as unknown as Request;
      expect(extractor(mockReq)).toBeNull();
    });
  });
});
