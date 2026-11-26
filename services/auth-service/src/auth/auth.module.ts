import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { EmailOtpService } from './email-otp.service';
import { PrismaService } from '../prisma.service';

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: 'zeromall-super-secret-key-12345', // Khóa bí mật dùng cho dev local
      signOptions: { expiresIn: '1d' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, EmailOtpService, PrismaService],
  exports: [AuthService, EmailOtpService],
})
export class AuthModule {}
