import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { BankAccountsService } from './bank-accounts.service';
import { CreateBankAccountDto } from './dto/create-bank-account.dto';
import { UpdateBankAccountDto } from './dto/update-bank-account.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/user.entity';

@Controller('bank-accounts')
@UseGuards(JwtAuthGuard)
export class BankAccountsController {
  constructor(private readonly bankAccountsService: BankAccountsService) {}

  // Mọi user đã login đều xem được (để biết tài khoản active → hiện QR)
  @Get()
  findAll() {
    return this.bankAccountsService.findAll();
  }

  @Get('active')
  getActive() {
    return this.bankAccountsService.getActive();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.bankAccountsService.findOne(id);
  }

  // CRUD: chỉ Admin
  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin')
  create(@Body() dto: CreateBankAccountDto, @CurrentUser() user: User) {
    return this.bankAccountsService.create(dto, user.id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateBankAccountDto) {
    return this.bankAccountsService.update(id, dto);
  }

  @Patch(':id/activate')
  @UseGuards(RolesGuard)
  @Roles('admin')
  activate(@Param('id', ParseIntPipe) id: number) {
    return this.bankAccountsService.activate(id);
  }

  @Patch(':id/deactivate')
  @UseGuards(RolesGuard)
  @Roles('admin')
  deactivate(@Param('id', ParseIntPipe) id: number) {
    return this.bankAccountsService.deactivate(id);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.bankAccountsService.remove(id);
  }
}
