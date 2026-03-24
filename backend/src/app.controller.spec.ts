import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RolesGuard } from './common/guards/roles.guard';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { Role } from './common/enums/role.enum';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        RolesGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('admin-only endpoint', () => {
    it('should return admin data', () => {
      expect(appController.getAdminData()).toBe('This is admin-only data');
    });
  });

  describe('RolesGuard integration', () => {
    const createMockContext = (user: { role?: string }): ExecutionContext => {
      return {
        switchToHttp: () => ({
          getRequest: () => ({ user }),
        }),
        getHandler: jest.fn(),
        getClass: jest.fn(),
      } as unknown as ExecutionContext;
    };

    it('should allow admin user to access admin-only route', () => {
      const reflector = new Reflector();
      const guard = new RolesGuard(reflector);
      const context = createMockContext({ role: Role.Admin });

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.Admin]);

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should deny regular user access to admin-only route', () => {
      const reflector = new Reflector();
      const guard = new RolesGuard(reflector);
      const context = createMockContext({ role: Role.User });

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.Admin]);

      expect(guard.canActivate(context)).toBe(false);
    });

    it('should allow access to routes without role requirements', () => {
      const reflector = new Reflector();
      const guard = new RolesGuard(reflector);
      const context = createMockContext({ role: Role.User });

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

      expect(guard.canActivate(context)).toBe(true);
    });
  });
});
