import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Keypair } from '@stellar/stellar-sdk';
import request from 'supertest';
import { User } from '../users/entities/user.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

const sign = (kp: Keypair, text: string): string =>
    kp.sign(Buffer.from(text, 'utf-8')).toString('hex');

// Mock the JwtAuthGuard
const mockJwtAuthGuard = {
    canActivate: jest.fn(() => true),
};

// Mock JwtService
const mockJwtService = {
    signAsync: jest.fn(),
    verify: jest.fn(),
    decode: jest.fn(),
};

describe('Auth E2E — challenge → verify flow', () => {
    let app: INestApplication;
    let mockUsersRepository: {
        findOneBy: jest.Mock;
        create: jest.Mock;
        save: jest.Mock;
    };
    // Remove unused variables - they're not needed for the tests
    // let authService: AuthService;
    // let jwtService: JwtService;

    beforeAll(async () => {
        // Setup mock repository with proper implementations
        mockUsersRepository = {
            findOneBy: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
        };

        // Configure JWT service mock
        mockJwtService.signAsync.mockResolvedValue('mock-jwt-token');

        const module: TestingModule = await Test.createTestingModule({
            controllers: [AuthController],
            providers: [
                AuthService,
                {
                    provide: JwtService,
                    useValue: mockJwtService,
                },
                JwtStrategy,
                Reflector,
                {
                    provide: ConfigService,
                    useValue: {
                        get: jest.fn((key: string) => {
                            const cfg: Record<string, string> = {
                                JWT_SECRET: 'super-secret-test-key-min-32-chars!!',
                                JWT_EXPIRES_IN: '1h',
                                JWT_ISSUER: 'insightarena',
                                JWT_AUDIENCE: 'insightarena-users',
                            };
                            return cfg[key];
                        }),
                    },
                },
                {
                    provide: getRepositoryToken(User),
                    useValue: mockUsersRepository,
                },
            ],
        })
            .overrideGuard(JwtAuthGuard)
            .useValue(mockJwtAuthGuard)
            .compile();

        app = module.createNestApplication();
        app.useGlobalPipes(new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true
        }));

        await app.init();

        // Remove these assignments since we're not using them
        // authService = module.get<AuthService>(AuthService);
        // jwtService = module.get<JwtService>(JwtService);
    });

    beforeEach(() => {
        // Reset all mocks before each test
        jest.clearAllMocks();

        // Default mock implementations
        mockUsersRepository.findOneBy.mockResolvedValue(null);
        mockUsersRepository.create.mockImplementation((dto: { stellar_address: string }) => {
            const user = new User();
            user.stellar_address = dto.stellar_address;
            user.id = 'e2e-uuid';
            return user;
        });
        mockUsersRepository.save.mockImplementation((user: User) => {
            return Promise.resolve({
                ...user,
                id: user.id || 'e2e-uuid',
            });
        });

        mockJwtService.signAsync.mockResolvedValue('mock-jwt-token');
    });

    afterAll(async () => {
        await app.close();
    });

    it('full happy-path: challenge → verify returns 200 with access_token and user', async () => {
        const kp = Keypair.random();
        const address = kp.publicKey();

        // Step 1: get a challenge
        const challengeRes = await request(app.getHttpServer())
            .post('/auth/challenge')
            .send({ stellar_address: address })
            .expect(200);

        // Use type assertion to help TypeScript understand the response structure
        const { challenge } = challengeRes.body as { challenge: string };
        expect(challenge).toMatch(/^InsightArena:nonce:/);

        // Mock user creation after verification
        const mockUser = {
            id: 'e2e-uuid',
            stellar_address: address,
        };
        mockUsersRepository.findOneBy.mockResolvedValueOnce(null);
        mockUsersRepository.create.mockReturnValueOnce(mockUser);
        mockUsersRepository.save.mockResolvedValueOnce(mockUser);

        // Step 2: sign it and verify
        const sig = sign(kp, challenge);

        const verifyRes = await request(app.getHttpServer())
            .post('/auth/verify')
            .send({ stellar_address: address, signed_challenge: sig })
            .expect(200);

        const body = verifyRes.body as { access_token: string; user: { stellar_address: string } };
        expect(body.access_token).toBeDefined();
        expect(body.access_token).toBe('mock-jwt-token');
        expect(body.user.stellar_address).toBe(address);

        // Verify JWT was signed with correct payload
        expect(mockJwtService.signAsync).toHaveBeenCalledWith({
            sub: 'e2e-uuid',
            stellar_address: address,
        });
    });

    it('returns 401 when signature is invalid', async () => {
        const kp = Keypair.random();
        const address = kp.publicKey();

        // Get a challenge first
        const challengeRes = await request(app.getHttpServer())
            .post('/auth/challenge')
            .send({ stellar_address: address })
            .expect(200);

        // Use the response but don't store it in an unused variable
        // The response is still valid even if we don't use it
        // challengeRes is used implicitly by expect(200)

        // Try to verify with invalid signature
        await request(app.getHttpServer())
            .post('/auth/verify')
            .send({ stellar_address: address, signed_challenge: 'not-a-real-signature' })
            .expect(401);

        // Verify that user was not created/saved
        expect(mockUsersRepository.save).not.toHaveBeenCalled();
        expect(mockJwtService.signAsync).not.toHaveBeenCalled();
    });

    it('returns 401 when no challenge has been generated (missing nonce)', async () => {
        const kp = Keypair.random();

        await request(app.getHttpServer())
            .post('/auth/verify')
            .send({ stellar_address: kp.publicKey(), signed_challenge: 'abc123' })
            .expect(401);

        expect(mockUsersRepository.save).not.toHaveBeenCalled();
        expect(mockJwtService.signAsync).not.toHaveBeenCalled();
    });

    it('returns 401 on replay: submitting the same signed challenge twice', async () => {
        const kp = Keypair.random();
        const address = kp.publicKey();

        // Get challenge
        const { body } = await request(app.getHttpServer())
            .post('/auth/challenge')
            .send({ stellar_address: address })
            .expect(200);

        const sig = sign(kp, (body as { challenge: string }).challenge);

        // Mock user for first successful submission
        const mockUser = {
            id: 'e2e-uuid',
            stellar_address: address,
        };
        mockUsersRepository.findOneBy.mockResolvedValueOnce(null);
        mockUsersRepository.create.mockReturnValueOnce(mockUser);
        mockUsersRepository.save.mockResolvedValueOnce(mockUser);

        // First submission succeeds
        await request(app.getHttpServer())
            .post('/auth/verify')
            .send({ stellar_address: address, signed_challenge: sig })
            .expect(200);

        // Reset mocks for second attempt
        mockUsersRepository.findOneBy.mockResolvedValue(mockUser);

        // Second submission must fail (replay)
        await request(app.getHttpServer())
            .post('/auth/verify')
            .send({ stellar_address: address, signed_challenge: sig })
            .expect(401);

        // Verify JWT was only signed once
        expect(mockJwtService.signAsync).toHaveBeenCalledTimes(1);
    });

    it('returns 401 when the challenge has expired', async () => {
        jest.useFakeTimers();

        const kp = Keypair.random();
        const address = kp.publicKey();

        // Get challenge
        const { body } = await request(app.getHttpServer())
            .post('/auth/challenge')
            .send({ stellar_address: address })
            .expect(200);

        // Advance time beyond TTL (5 minutes)
        jest.advanceTimersByTime(300_001);

        const sig = sign(kp, (body as { challenge: string }).challenge);

        await request(app.getHttpServer())
            .post('/auth/verify')
            .send({ stellar_address: address, signed_challenge: sig })
            .expect(401);

        jest.useRealTimers();

        expect(mockUsersRepository.save).not.toHaveBeenCalled();
        expect(mockJwtService.signAsync).not.toHaveBeenCalled();
    });

    it('returns 400 when required fields are missing', async () => {
        await request(app.getHttpServer())
            .post('/auth/verify')
            .send({ stellar_address: 'GABC' }) // missing signed_challenge
            .expect(400);
    });

    it('handles existing users correctly', async () => {
        const kp = Keypair.random();
        const address = kp.publicKey();
        const existingUser = {
            id: 'existing-user-id',
            stellar_address: address,
            created_at: new Date(),
        };

        // Mock existing user
        mockUsersRepository.findOneBy.mockResolvedValue(existingUser);
        mockUsersRepository.save.mockResolvedValue(existingUser);

        // Get challenge
        const challengeRes = await request(app.getHttpServer())
            .post('/auth/challenge')
            .send({ stellar_address: address })
            .expect(200);

        const { challenge } = challengeRes.body as { challenge: string };
        const sig = sign(kp, challenge);

        // Verify with existing user
        const verifyRes = await request(app.getHttpServer())
            .post('/auth/verify')
            .send({ stellar_address: address, signed_challenge: sig })
            .expect(200);

        const body = verifyRes.body as { access_token: string; user: { id: string; stellar_address: string } };
        expect(body.access_token).toBe('mock-jwt-token');
        expect(body.user.id).toBe('existing-user-id');
        expect(body.user.stellar_address).toBe(address);

        // Verify that create was not called (user already exists)
        expect(mockUsersRepository.create).not.toHaveBeenCalled();

        // Verify JWT was signed with existing user ID
        expect(mockJwtService.signAsync).toHaveBeenCalledWith({
            sub: 'existing-user-id',
            stellar_address: address,
        });
    });

    it('handles concurrent challenge requests', async () => {
        const kp1 = Keypair.random();
        const kp2 = Keypair.random();
        const address1 = kp1.publicKey();
        const address2 = kp2.publicKey();

        // Get challenges for both users
        const [challengeRes1, challengeRes2] = await Promise.all([
            request(app.getHttpServer())
                .post('/auth/challenge')
                .send({ stellar_address: address1 }),
            request(app.getHttpServer())
                .post('/auth/challenge')
                .send({ stellar_address: address2 }),
        ]);

        expect(challengeRes1.status).toBe(200);
        expect(challengeRes2.status).toBe(200);

        const challenge1 = (challengeRes1.body as { challenge: string }).challenge;
        const challenge2 = (challengeRes2.body as { challenge: string }).challenge;

        const sig1 = sign(kp1, challenge1);
        const sig2 = sign(kp2, challenge2);

        // Mock users
        const mockUser1 = { id: 'user1-id', stellar_address: address1 };
        const mockUser2 = { id: 'user2-id', stellar_address: address2 };

        mockUsersRepository.findOneBy
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(null);
        mockUsersRepository.create
            .mockReturnValueOnce(mockUser1)
            .mockReturnValueOnce(mockUser2);
        mockUsersRepository.save
            .mockResolvedValueOnce(mockUser1)
            .mockResolvedValueOnce(mockUser2);

        // Verify both users
        const [verifyRes1, verifyRes2] = await Promise.all([
            request(app.getHttpServer())
                .post('/auth/verify')
                .send({ stellar_address: address1, signed_challenge: sig1 }),
            request(app.getHttpServer())
                .post('/auth/verify')
                .send({ stellar_address: address2, signed_challenge: sig2 }),
        ]);

        expect(verifyRes1.status).toBe(200);
        expect(verifyRes2.status).toBe(200);

        expect(mockJwtService.signAsync).toHaveBeenCalledTimes(2);
    });
});

