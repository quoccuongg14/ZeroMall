import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma.service';
import type { OtpPurpose } from './dto/auth.dto';

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_COOLDOWN_MS = 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

const PURPOSE_META: Record<OtpPurpose, { subject: string; heading: string; actionText: string }> = {
  REGISTER: {
    subject: '[ZeroMall] Mã xác nhận đăng ký tài khoản',
    heading: 'Xác nhận Email đăng ký ZeroMall',
    actionText: 'hoàn tất đăng ký tài khoản',
  },
  RESET_PASSWORD: {
    subject: '[ZeroMall] Mã khôi phục mật khẩu',
    heading: 'Khôi phục mật khẩu ZeroMall',
    actionText: 'đặt lại mật khẩu mới',
  },
  CHANGE_PASSWORD: {
    subject: '[ZeroMall] Mã xác thực bảo mật tài khoản',
    heading: 'Xác thực đổi thông tin bảo mật',
    actionText: 'xác nhận thay đổi bảo mật',
  },
};

@Injectable()
export class EmailOtpService {
  constructor(private readonly prisma: PrismaService) {}

  normalizeEmail(email: string): string {
    return (email || '').trim().toLowerCase();
  }

  private hashOtp(email: string, purpose: OtpPurpose, code: string): string {
    return crypto
      .createHash('sha256')
      .update(`${this.normalizeEmail(email)}:${purpose}:${code.trim()}`)
      .digest('hex');
  }

  hasMailConfigured(): boolean {
    return !!(
      process.env.RESEND_API_KEY?.trim() ||
      (process.env.SMTP_USER?.trim() && process.env.SMTP_PASS?.trim())
    );
  }

  private buildOtpHtml(heading: string, actionText: string, code: string): string {
    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #059669, #0d9488); padding: 24px 28px; color: #ffffff;">
          <div style="font-size: 20px; font-weight: 800; letter-spacing: -0.3px;">🌱 ZeroMall</div>
          <div style="font-size: 13px; opacity: 0.92; margin-top: 4px;">${heading}</div>
        </div>
        <div style="padding: 28px; color: #1e293b; font-size: 14px; line-height: 1.6;">
          <p style="margin: 0 0 12px;">Xin chào,</p>
          <p style="margin: 0 0 20px;">Sử dụng mã xác thực OTP gồm 6 chữ số bên dưới để <strong>${actionText}</strong> trên ZeroMall:</p>
          <div style="background: #f8fafc; border: 1.5px dashed #10b981; border-radius: 12px; padding: 18px; text-align: center; margin-bottom: 20px;">
            <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #047857;">${code}</span>
          </div>
          <p style="margin: 0 0 8px; font-size: 13px; color: #475569;">• Mã có hiệu lực trong <strong>5 phút</strong>.</p>
          <p style="margin: 0; font-size: 13px; color: #475569;">• Tuyệt đối không chia sẻ mã này cho bất kỳ ai, kể cả nhân viên hỗ trợ.</p>
        </div>
        <div style="background: #f8fafc; padding: 14px 28px; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0;">
          Email được gửi tự động từ hệ thống bảo mật ZeroMall (zeromall.id.vn).
        </div>
      </div>
    `;
  }

  private async dispatchEmail(to: string, subject: string, html: string): Promise<void> {
    const resendApiKey = process.env.RESEND_API_KEY?.trim();
    if (resendApiKey) {
      const fromAddr = process.env.SMTP_FROM?.trim() || 'ZeroMall Security <noreply@zeromall.id.vn>';
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromAddr,
          to: [to],
          subject,
          html,
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new ServiceUnavailableException(`Không thể gửi email OTP qua Resend (${res.status}): ${body}`);
      }
      return;
    }

    const smtpUser = process.env.SMTP_USER?.trim();
    const smtpPass = process.env.SMTP_PASS?.trim();
    if (!smtpUser || !smtpPass) {
      throw new ServiceUnavailableException(
        'Hệ thống gửi Email chưa được cấu hình (thiếu SMTP_USER / SMTP_PASS hoặc RESEND_API_KEY trong .env).'
      );
    }

    const host = process.env.SMTP_HOST?.trim() || 'smtp.gmail.com';
    const port = Number(process.env.SMTP_PORT || 465);
    const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465;

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    const fromHeader = process.env.SMTP_FROM?.trim() || `ZeroMall <${smtpUser}>`;
    await transporter.sendMail({
      from: fromHeader,
      to,
      subject,
      html,
    });
  }

  async sendOtp(rawEmail: string, purpose: OtpPurpose) {
    const email = this.normalizeEmail(rawEmail);
    const meta = PURPOSE_META[purpose];
    if (!meta) {
      throw new BadRequestException('Mục đích gửi OTP không hợp lệ.');
    }

    if (!this.hasMailConfigured()) {
      throw new ServiceUnavailableException(
        'Hệ thống gửi mã OTP qua Gmail chưa được cấu hình (vui lòng thêm SMTP_USER và SMTP_PASS vào file .env).'
      );
    }

    const latest = await this.prisma.emailOtp.findFirst({
      where: { email, purpose, usedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (latest) {
      const elapsed = Date.now() - latest.createdAt.getTime();
      if (elapsed < OTP_COOLDOWN_MS) {
        const waitSec = Math.ceil((OTP_COOLDOWN_MS - elapsed) / 1000);
        throw new BadRequestException(`Vui lòng đợi ${waitSec} giây trước khi gửi lại mã mới.`);
      }
    }

    const code = String(crypto.randomInt(100000, 1000000));
    const codeHash = this.hashOtp(email, purpose, code);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    // Vô hiệu hóa các mã cũ chưa dùng để mỗi thời điểm chỉ 1 mã mới nhất có hiệu lực
    await this.prisma.emailOtp.updateMany({
      where: { email, purpose, usedAt: null },
      data: { usedAt: new Date() },
    });

    const record = await this.prisma.emailOtp.create({
      data: {
        email,
        purpose,
        codeHash,
        expiresAt,
      },
    });

    try {
      await this.dispatchEmail(
        email,
        meta.subject,
        this.buildOtpHtml(meta.heading, meta.actionText, code)
      );
    } catch (err) {
      // Hủy record nếu gửi mail thất bại để người dùng thử lại ngay không bị kẹt cooldown 60s
      await this.prisma.emailOtp.delete({ where: { id: record.id } }).catch(() => {});
      throw err;
    }

    return {
      success: true,
      message: 'Mã xác thực 6 số đã được gửi tới email của bạn (có hiệu lực 5 phút).',
      expiresInSeconds: OTP_TTL_MS / 1000,
      cooldownSeconds: OTP_COOLDOWN_MS / 1000,
    };
  }

  async verifyAndConsumeOtp(rawEmail: string, purpose: OtpPurpose, otpCode?: string): Promise<void> {
    const email = this.normalizeEmail(rawEmail);
    const cleanCode = (otpCode || '').trim();
    if (!/^\d{6}$/.test(cleanCode)) {
      throw new BadRequestException('Vui lòng nhập đủ mã OTP gồm 6 chữ số đã gửi về Email.');
    }

    const latest = await this.prisma.emailOtp.findFirst({
      where: { email, purpose, usedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!latest) {
      throw new BadRequestException('Mã OTP không tồn tại hoặc đã được sử dụng. Vui lòng bấm Gửi mã mới.');
    }

    if (latest.expiresAt.getTime() < Date.now()) {
      await this.prisma.emailOtp.update({ where: { id: latest.id }, data: { usedAt: new Date() } });
      throw new BadRequestException('Mã OTP đã hết hạn (quá 5 phút). Vui lòng gửi lại mã mới.');
    }

    if (latest.attempts >= MAX_OTP_ATTEMPTS) {
      await this.prisma.emailOtp.update({ where: { id: latest.id }, data: { usedAt: new Date() } });
      throw new BadRequestException('Bạn đã nhập sai OTP quá 5 lần. Vui lòng bấm gửi mã mới.');
    }

    const expectedHash = this.hashOtp(email, purpose, cleanCode);
    if (latest.codeHash !== expectedHash) {
      const nextAttempts = latest.attempts + 1;
      await this.prisma.emailOtp.update({
        where: { id: latest.id },
        data: {
          attempts: nextAttempts,
          ...(nextAttempts >= MAX_OTP_ATTEMPTS ? { usedAt: new Date() } : {}),
        },
      });
      const remaining = MAX_OTP_ATTEMPTS - nextAttempts;
      throw new BadRequestException(
        remaining > 0
          ? `Mã OTP không chính xác (còn ${remaining} lần thử).`
          : 'Mã OTP sai quá 5 lần và đã bị hủy. Vui lòng yêu cầu mã mới.'
      );
    }

    await this.prisma.emailOtp.update({
      where: { id: latest.id },
      data: { usedAt: new Date() },
    });
  }

  async sendSecurityAlert(rawEmail: string, subject: string, title: string, message: string): Promise<void> {
    if (!this.hasMailConfigured()) return;
    const email = this.normalizeEmail(rawEmail);
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden;">
        <div style="background: #0f172a; color: #ffffff; padding: 20px 24px; font-weight: 800; font-size: 16px;">🛡️ ZeroMall — ${title}</div>
        <div style="padding: 24px; font-size: 14px; color: #334155; line-height: 1.6;">
          <p style="margin: 0;">${message}</p>
        </div>
      </div>
    `;
    await this.dispatchEmail(email, subject, html).catch(() => {});
  }
}
