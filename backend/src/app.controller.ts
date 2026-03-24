import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './common/decorators/public.decorator';
import { Roles } from './common/decorators/roles.decorator';
import { Role } from './common/enums/role.enum';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Roles(Role.Admin)
  @Get('admin-only')
  getAdminData(): string {
    return 'This is admin-only data';
  }
}
