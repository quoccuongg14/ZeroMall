export type OtpPurpose = 'REGISTER' | 'RESET_PASSWORD' | 'CHANGE_PASSWORD';

export class RegisterDto {
  email: string;
  password: string;
  name: string;
  role: 'BUYER' | 'ADMIN' | 'SHOP_OWNER' | 'SHOP_STAFF' | 'PLATFORM_SUPPORT';
  gender?: string; // Optional: 'NAM' | 'NU' | 'KHAC'
  shopId?: string; // Optional: Only for SHOP_STAFF
  shopName?: string; // Optional: For SHOP_OWNER to auto-create a Shop
  otpCode?: string; // Required for public email verification
}

export class LoginDto {
  email: string;
  password: string;
}

export class SendOtpDto {
  email: string;
  purpose: OtpPurpose;
}

export class ResetPasswordDto {
  email: string;
  otpCode: string;
  newPassword: string;
}

export class GoogleAuthDto {
  idToken: string;
}
