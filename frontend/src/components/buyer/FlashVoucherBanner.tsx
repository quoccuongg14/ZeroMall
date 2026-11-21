import React, { useState, useEffect, useMemo } from 'react';
import { API_BASE_URL } from '../../config/api.config';

interface VoucherItem {
  id: string;
  shopId?: string;
  name: string;
  code: string;
  type: string;
  value: number;
  minSpend: number;
  maxDiscount?: number | null;
  usageLimit: number;
  usedCount: number;
  isClaimable: boolean;
  isClaimed?: boolean;
  startDate: string;
  endDate: string;
}

interface FlashVoucherBannerProps {
  user?: any;
  onRequireLogin?: () => void;
}

export const FlashVoucherBanner: React.FC<FlashVoucherBannerProps> = ({ user, onRequireLogin }) => {
  const [vouchers, setVouchers] = useState<VoucherItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [claimedIds, setClaimedIds] = useState<Set<string>>(new Set());
  const [activeSlot, setActiveSlot] = useState<string>('12:00');
  const [countdown, setCountdown] = useState<string>('00:00:00');

  // Khung giờ vàng cố định chuẩn sàn Shopee
  const GOLDEN_SLOTS = [
    { time: '00:00', label: '00:00 Săn Đêm', hour: 0 },
    { time: '09:00', label: '09:00 Deal Sáng', hour: 9 },
    { time: '12:00', label: '12:00 Giờ Vàng', hour: 12 },
    { time: '21:00', label: '21:00 Chốt Đơn', hour: 21 },
  ];

  // Xác định khung giờ hiện tại và đếm ngược
  useEffect(() => {
    const updateSlotAndCountdown = () => {
      const now = new Date();
      const currentHour = now.getHours();

      // Tìm slot đang chạy
      let matchedSlot = GOLDEN_SLOTS[0];
      for (let i = GOLDEN_SLOTS.length - 1; i >= 0; i--) {
        if (currentHour >= GOLDEN_SLOTS[i].hour) {
          matchedSlot = GOLDEN_SLOTS[i];
          break;
        }
      }
      setActiveSlot(matchedSlot.time);

      // Tìm slot tiếp theo để đếm ngược
      let nextSlotHour = GOLDEN_SLOTS[0].hour;
      let nextDay = false;
      const nextSlot = GOLDEN_SLOTS.find(s => s.hour > currentHour);
      if (nextSlot) {
        nextSlotHour = nextSlot.hour;
      } else {
        nextDay = true;
      }

      const targetDate = new Date(now);
      if (nextDay) {
        targetDate.setDate(targetDate.getDate() + 1);
      }
      targetDate.setHours(nextSlotHour, 0, 0, 0);

      const diffSec = Math.max(0, Math.floor((targetDate.getTime() - now.getTime()) / 1000));
      const hours = Math.floor(diffSec / 3600);
      const minutes = Math.floor((diffSec % 3600) / 60);
      const seconds = diffSec % 60;
      setCountdown(
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      );
    };

    updateSlotAndCountdown();
    const timer = setInterval(updateSlotAndCountdown, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch active claimable vouchers
  const fetchVouchers = async () => {
    setLoading(true);
    try {
      const url = user?.id
        ? `${API_BASE_URL}/discounts/all-active?userId=${user.id}`
        : `${API_BASE_URL}/discounts/all-active`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setVouchers(list);

        // Lưu các voucher user đã claim vào Set
        const claimedSet = new Set<string>();
        list.forEach((v: VoucherItem) => {
          if (v.isClaimed) claimedSet.add(v.id);
        });
        setClaimedIds(claimedSet);
      }
    } catch (err) {
      console.error('Lỗi tải danh sách voucher giờ vàng:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVouchers();
  }, [user?.id]);

  // Lọc các voucher toàn sàn hoặc voucher có gắn cờ isClaimable
  const claimableVouchers = useMemo(() => {
    return vouchers.filter(v => v.shopId === 'PLATFORM' || v.isClaimable);
  }, [vouchers]);

  // Xử lý bấm "Lưu Voucher"
  const handleClaim = async (v: VoucherItem) => {
    if (!user) {
      if (onRequireLogin) onRequireLogin();
      else alert('Vui lòng đăng nhập để lưu voucher vào ví của bạn!');
      return;
    }

    if (claimedIds.has(v.id)) return;

    setClaimingId(v.id);
    try {
      const res = await fetch(`${API_BASE_URL}/discounts/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, voucherId: v.id })
      });

      if (res.ok) {
        setClaimedIds(prev => new Set(prev).add(v.id));
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.message || 'Không thể lưu voucher');
      }
    } catch (err: any) {
      alert('Lỗi: ' + err.message);
    } finally {
      setClaimingId(null);
    }
  };

  if (claimableVouchers.length === 0 && !loading) {
    return null; // Không hiển thị nếu không có voucher nào
  }

  return (
    <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-950 rounded-3xl p-5 sm:p-6 text-white shadow-xl shadow-emerald-950/20 mb-8 overflow-hidden relative selection:bg-white selection:text-emerald-700 text-left">
      
      {/* Background Glow Decorations */}
      <div className="absolute -top-16 -right-16 w-56 h-56 bg-white/10 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-16 w-56 h-56 bg-emerald-400/20 rounded-full blur-2xl pointer-events-none" />

      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/20 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-2xl shadow-inner shrink-0">
            ⚡
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black tracking-tight text-white uppercase">
                Khung Giờ Vàng Săn Voucher
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 shadow-3xs animate-pulse">
                FCFS Nhanh Tay
              </span>
            </div>
            <p className="text-xs text-emerald-100/90 font-semibold mt-0.5">
              Bấm <strong>"Lưu Vào Ví"</strong> ngay để giữ chỗ • Khi thanh toán, <strong>ai chốt đơn trước được áp dụng trước</strong>!
            </p>
          </div>
        </div>

        {/* Khung Giờ & Đồng Hồ Đếm Ngược */}
        <div className="flex items-center gap-3 bg-black/25 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/15 shrink-0">
          <div className="text-left">
            <div className="text-[10px] font-black uppercase text-emerald-200 tracking-wider">
              Khung giờ tiếp theo
            </div>
            <div className="font-mono text-base font-black text-white tracking-widest">
              {countdown}
            </div>
          </div>
          <div className="h-8 w-px bg-white/20" />
          <div className="text-xs font-black text-amber-300">
            Slot: {activeSlot}
          </div>
        </div>
      </div>

      {/* Golden Hour Slots Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 my-4 relative z-10">
        {GOLDEN_SLOTS.map((slot) => {
          const isCurrent = slot.time === activeSlot;
          return (
            <div
              key={slot.time}
              className={`py-2 px-3 rounded-xl text-center border transition-all ${
                isCurrent
                  ? 'bg-white text-emerald-900 border-white shadow-md font-black scale-102'
                  : 'bg-white/10 text-white/80 border-white/10 font-bold hover:bg-white/15'
              }`}
            >
              <div className="text-xs font-black">{slot.label}</div>
              <div className="text-[10px] opacity-80 mt-0.5">
                {isCurrent ? '⚡ Đang Diễn Ra' : 'Sắp Mở'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Voucher Cards Carousel/Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-1 relative z-10">
        {claimableVouchers.map((v) => {
          const isClaimed = claimedIds.has(v.id);
          const isExhausted = v.usedCount >= v.usageLimit;
          const usagePercent = Math.min(Math.round((v.usedCount / (v.usageLimit || 1)) * 100), 100);
          const isClaiming = claimingId === v.id;

          return (
            <div
              key={v.id}
              className="bg-white rounded-2xl p-4 text-slate-800 shadow-md border border-white/40 flex flex-col justify-between relative overflow-hidden transition-all hover:shadow-lg"
            >
              {/* Top Row: Tag & Code */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-100">
                    Sàn Trợ Giá
                  </span>
                  <span className="font-mono font-black text-xs text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                    {v.code}
                  </span>
                </div>

                {/* Discount Value */}
                <div className="text-xl font-black text-emerald-600 tracking-tight">
                  Giảm {v.type === 'percentage' ? `${v.value}%` : `${Number(v.value).toLocaleString('vi-VN')}₫`}
                  {v.maxDiscount ? ` (Tối đa ${Number(v.maxDiscount).toLocaleString('vi-VN')}₫)` : ''}
                </div>

                <div className="text-xs font-bold text-slate-700 mt-1 line-clamp-1">
                  {v.name}
                </div>

                <div className="text-[11px] text-slate-400 font-semibold mt-0.5">
                  Đơn tối thiểu: <strong>{Number(v.minSpend || 0).toLocaleString('vi-VN')}₫</strong>
                </div>
              </div>

              {/* Bottom Row: FCFS Progress Bar & Claim Button */}
              <div className="mt-4 pt-3 border-t border-slate-100 space-y-2.5">
                
                {/* Real-time FCFS Usage Meter */}
                <div>
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 mb-1">
                    <span>
                      {isExhausted ? (
                        <strong className="text-rose-600">Đã hết lượt ngân sách</strong>
                      ) : (
                        <span>Đã dùng <strong>{v.usedCount}/{v.usageLimit}</strong> ({usagePercent}%)</span>
                      )}
                    </span>
                    <span className="text-emerald-700 font-black">
                      {isExhausted ? 'HẾT' : 'FCFS'}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isExhausted ? 'bg-rose-500' : usagePercent > 70 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${usagePercent}%` }}
                    />
                  </div>
                </div>

                {/* Action Button: Lưu vào ví */}
                <button
                  type="button"
                  disabled={isClaimed || isClaiming}
                  onClick={() => handleClaim(v)}
                  className={`w-full py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-3xs ${
                    isClaimed
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default'
                      : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-emerald-600/20 active:scale-98'
                  }`}
                >
                  {isClaiming ? (
                    <span>Đang lưu...</span>
                  ) : isClaimed ? (
                    <>
                      <span>✅</span>
                      <span>Đã Trong Ví Của Bạn</span>
                    </>
                  ) : (
                    <>
                      <span>⚡</span>
                      <span>Lưu Vào Ví Ngay</span>
                    </>
                  )}
                </button>

              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};
