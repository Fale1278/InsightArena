import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { CurrentUser } from './current-user.decorator';
import { User } from '../../users/entities/user.entity';

describe('CurrentUser Decorator', () => {
  /**
   * Mock ExecutionContext
   */
  const createMockExecutionContext = (user?: Partial<User>): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          user,
        }),
      }),
    } as unknown as ExecutionContext);

  it('should return the user when request.user exists', () => {
    const mockUser = {
      id: '123',
      email: 'test@example.com',
    } as unknown as User; // ✅ FIX

    const ctx = createMockExecutionContext(mockUser);

    const result = (CurrentUser as any).factory(undefined, ctx);

    expect(result).toEqual(mockUser);
  });

  it('should throw UnauthorizedException when user is missing', () => {
    const ctx = createMockExecutionContext(undefined);

    expect(() =>
      (CurrentUser as any).factory(undefined, ctx),
    ).toThrow(UnauthorizedException);
  });
});