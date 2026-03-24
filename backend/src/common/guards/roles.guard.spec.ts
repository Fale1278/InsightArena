import { RolesGuard } from './roles.guard';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { Role } from '../enums/role.enum';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  const createMockExecutionContext = (user: {
    role?: string;
  }): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;
  };

  describe('canActivate', () => {
    it('should allow access when no roles are required', () => {
      const context = createMockExecutionContext({ role: 'user' });
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should allow access for admin user on admin-only route', () => {
      const context = createMockExecutionContext({ role: Role.Admin });
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.Admin]);

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should deny access for regular user on admin-only route', () => {
      const context = createMockExecutionContext({ role: Role.User });
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.Admin]);

      expect(guard.canActivate(context)).toBe(false);
    });

    it('should allow access for user with matching role', () => {
      const context = createMockExecutionContext({ role: Role.User });
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.User]);

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should allow access when user has one of multiple required roles', () => {
      const context = createMockExecutionContext({ role: Role.Admin });
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue([Role.User, Role.Admin]);

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should deny access when user role does not match any required roles', () => {
      const context = createMockExecutionContext({ role: Role.User });
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.Admin]);

      expect(guard.canActivate(context)).toBe(false);
    });

    it('should handle user with no role field', () => {
      const context = createMockExecutionContext({});
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.Admin]);

      expect(guard.canActivate(context)).toBe(false);
    });

    it('should handle user with invalid role', () => {
      const context = createMockExecutionContext({ role: 'invalid' });
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.Admin]);

      expect(guard.canActivate(context)).toBe(false);
    });
  });
});
