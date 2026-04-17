import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { buildSearchWhere } from '../../common/utils/search.util';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  private stripPassword(user: User) {
    const { password, ...rest } = user;
    return rest;
  }

  async findAll(query: QueryUsersDto) {
    const { search, role, page = 1, limit = 20 } = query;
    const qb = this.userRepo.createQueryBuilder('user');

    if (search) {
      const { sql, params } = buildSearchWhere(
        ['user.full_name', 'user.email', 'user.phone'],
        search,
      );
      qb.where(sql, params);
    }

    if (role) {
      qb.andWhere('user.role = :role', { role });
    }

    qb.orderBy('user.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data: data.map((u) => this.stripPassword(u)),
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: number) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Không tìm thấy nhân viên');
    return this.stripPassword(user);
  }

  async create(dto: CreateUserDto) {
    const existing = await this.userRepo.findOne({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email đã được sử dụng');

    const hashed = await bcrypt.hash(dto.password, 10);
    const user = this.userRepo.create({
      ...dto,
      password: hashed,
      is_active: dto.is_active ?? 1,
    });

    const saved = await this.userRepo.save(user);
    return this.stripPassword(saved);
  }

  private async countActiveAdmins(): Promise<number> {
    return this.userRepo.count({ where: { role: 'admin', is_active: 1 } });
  }

  async update(id: number, dto: UpdateUserDto, currentUserId: number) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Không tìm thấy nhân viên');

    if (dto.email && dto.email !== user.email) {
      const duplicate = await this.userRepo.findOne({ where: { email: dto.email } });
      if (duplicate) throw new ConflictException('Email đã được sử dụng');
    }

    // Không cho phép tự vô hiệu hoá chính mình
    if (id === currentUserId && dto.is_active === 0) {
      throw new BadRequestException('Không thể vô hiệu hoá tài khoản của chính bạn');
    }

    // Không cho phép tự đổi role chính mình
    if (id === currentUserId && dto.role && dto.role !== user.role) {
      throw new BadRequestException('Không thể thay đổi vai trò của chính bạn');
    }

    // Chặn demote/disable admin cuối cùng (tránh khoá hệ thống)
    const isCurrentlyActiveAdmin = user.role === 'admin' && user.is_active === 1;
    const willLoseAdminStatus =
      (dto.role && dto.role !== 'admin') || dto.is_active === 0;

    if (isCurrentlyActiveAdmin && willLoseAdminStatus) {
      const activeAdmins = await this.countActiveAdmins();
      if (activeAdmins <= 1) {
        throw new BadRequestException(
          'Không thể thay đổi vai trò hoặc vô hiệu hoá quản trị viên cuối cùng',
        );
      }
    }

    if (dto.password) {
      dto.password = await bcrypt.hash(dto.password, 10);
    } else {
      delete dto.password;
    }

    Object.assign(user, dto);
    const saved = await this.userRepo.save(user);
    return this.stripPassword(saved);
  }

  async remove(id: number, currentUserId: number) {
    if (id === currentUserId) {
      throw new BadRequestException('Không thể xoá tài khoản của chính bạn');
    }
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Không tìm thấy nhân viên');

    // Chặn xoá admin cuối cùng
    if (user.role === 'admin' && user.is_active === 1) {
      const activeAdmins = await this.countActiveAdmins();
      if (activeAdmins <= 1) {
        throw new BadRequestException('Không thể xoá quản trị viên cuối cùng');
      }
    }

    await this.userRepo.remove(user);
    return { message: 'Đã xoá nhân viên thành công' };
  }
}
