import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

const avatarStorage = diskStorage({
  destination: './uploads/avatars',
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, unique);
  },
});

const avatarFilter = (req, file, cb) => {
  if (!/\.(jpg|jpeg|png|webp)$/i.test(file.originalname)) {
    return cb(new BadRequestException('Chỉ chấp nhận file ảnh (jpg, jpeg, png, webp)'), false);
  }
  cb(null, true);
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req) {
    return this.authService.getProfile(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  updateProfile(@Request() req, @Body() dto: UpdateProfileDto) {
    return this.authService.updateProfile(req.user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('change-password')
  changePassword(@Request() req, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(req.user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('avatar')
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: avatarStorage,
      fileFilter: avatarFilter,
      limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
    }),
  )
  uploadAvatar(@Request() req, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Vui lòng chọn file ảnh');
    const avatarPath = `uploads/avatars/${file.filename}`;
    return this.authService.updateAvatar(req.user.id, avatarPath);
  }
}
