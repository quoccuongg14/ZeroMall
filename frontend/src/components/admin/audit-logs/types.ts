export type AuditLogModule = 
  | 'ALL' 
  | 'ORDERS' 
  | 'FINANCE' 
  | 'PRODUCTS' 
  | 'SHOPS' 
  | 'USERS' 
  | 'MARKETING' 
  | 'SECURITY' 
  | 'SYSTEM';

export type AuditLogActionType = 
  | 'ALL' 
  | 'CREATE' 
  | 'UPDATE' 
  | 'DELETE' 
  | 'APPROVE' 
  | 'REJECT' 
  | 'LOCK' 
  | 'UNLOCK' 
  | 'SECURITY';

export interface AuditLogItem {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  module?: string;
  actionType?: string;
  targetId?: string | null;
  targetName?: string | null;
  ipAddress?: string | null;
  metadata?: string | null;
}

export const MODULE_CONFIG: Record<string, { label: string; icon: string; bg: string; text: string; border: string }> = {
  ORDERS: {
    label: 'Đơn Hàng & Vận Chuyển',
    icon: '🛒',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
  },
  FINANCE: {
    label: 'Tài Chính & Ví Sàn',
    icon: '💰',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
  },
  PRODUCTS: {
    label: 'Kiểm Duyệt Sản Phẩm',
    icon: '📦',
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
  },
  SHOPS: {
    label: 'Quản Trị Cửa Hàng',
    icon: '🏪',
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
  },
  USERS: {
    label: 'Tài Khoản Người Dùng',
    icon: '👥',
    bg: 'bg-cyan-50',
    text: 'text-cyan-700',
    border: 'border-cyan-200',
  },
  MARKETING: {
    label: 'Banner & Voucher',
    icon: '🎟️',
    bg: 'bg-pink-50',
    text: 'text-pink-700',
    border: 'border-pink-200',
  },
  SECURITY: {
    label: 'Bảo Mật & Phân Quyền',
    icon: '🛡️',
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
  },
  SYSTEM: {
    label: 'Cấu Hình Hệ Thống',
    icon: '⚙️',
    bg: 'bg-slate-50',
    text: 'text-slate-700',
    border: 'border-slate-200',
  },
};

export const ACTION_TYPE_CONFIG: Record<string, { label: string; badgeClass: string; icon: string }> = {
  CREATE: {
    label: 'TẠO MỚI',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    icon: '➕',
  },
  UPDATE: {
    label: 'CẬP NHẬT',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
    icon: '✏️',
  },
  APPROVE: {
    label: 'PHÊ DUYỆT',
    badgeClass: 'bg-teal-100 text-teal-800 border-teal-300',
    icon: '✅',
  },
  UNLOCK: {
    label: 'MỞ KHÓA',
    badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    icon: '🔓',
  },
  LOCK: {
    label: 'KHÓA / PHẠT',
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
    icon: '🔒',
  },
  REJECT: {
    label: 'TỪ CHỐI',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
    icon: '⛔',
  },
  DELETE: {
    label: 'XÓA BỎ',
    badgeClass: 'bg-red-100 text-red-900 border-red-300',
    icon: '🗑️',
  },
  SECURITY: {
    label: 'AN NINH / DATA',
    badgeClass: 'bg-violet-100 text-violet-900 border-violet-300',
    icon: '⚠️',
  },
};
