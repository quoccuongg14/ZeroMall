export class CreateVoucherDto {
  name: string;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  minSpend: number;
  maxDiscount?: number | null;
  usageLimit: number;
  targetUserId?: string | null;
  isClaimable?: boolean;
  startDate: string;
  endDate: string;
}

export class ClaimVoucherDto {
  userId: string;
  voucherId: string;
}

export class UseVouchersDto {
  voucherIds: string[];
  userId?: string;
  orderId?: string;
}

export class RollbackVouchersDto {
  voucherIds: string[];
  userId?: string;
  orderId?: string;
}
