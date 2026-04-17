import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../users/user.entity';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  private stripPassword(user: User) {
    const { password, ...rest } = user;
    return rest;
  }

  async login(dto: LoginDto) {
    const user = await this.userRepo.findOne({ where: { email: dto.email } });
    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    if (!user.is_active) {
      throw new UnauthorizedException('Tài khoản đã bị vô hiệu hóa');
    }

    const isMatch = await bcrypt.compare(dto.password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    const payload = { sub: user.id, email: user.email, role: user.role };

    return {
      access_token: this.jwtService.sign(payload),
      user: this.stripPassword(user),
    };
  }

  async getProfile(userId: number) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Người dùng không tồn tại');
    }
    return this.stripPassword(user);
  }

  /**
   * User tự cập nhật thông tin cá nhân (không thể đổi email/role/is_active ở đây).
   */
  async updateProfile(userId: number, dto: UpdateProfileDto) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');

    if (dto.full_name !== undefined) user.full_name = dto.full_name;
    if (dto.phone !== undefined) user.phone = dto.phone;

    const saved = await this.userRepo.save(user);
    return this.stripPassword(saved);
  }

  /**
   * Đổi password: xác thực mật khẩu cũ trước khi đổi.
   */
  async changePassword(userId: number, dto: ChangePasswordDto) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');

    const isMatch = await bcrypt.compare(dto.old_password, user.password);
    if (!isMatch) {
      throw new BadRequestException('Mật khẩu hiện tại không đúng');
    }

    if (dto.old_password === dto.new_password) {
      throw new BadRequestException('Mật khẩu mới phải khác mật khẩu cũ');
    }

    user.password = await bcrypt.hash(dto.new_password, 10);
    await this.userRepo.save(user);
    return { message: 'Đổi mật khẩu thành công' };
  }

  /**
   * Lưu đường dẫn avatar (đã upload qua multer).
   */
  async updateAvatar(userId: number, avatarPath: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');

    user.avatar = avatarPath;
    const saved = await this.userRepo.save(user);
    return this.stripPassword(saved);
  }
}
