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
  claimedCount?: number;
  isClaimable: boolean;
  isClaimed?: boolean;
  startDate: string;
  endDate: string;
}

interface FlashVoucherBannerProps {
  user?: any;
  onRequireLogin?: () => void;
}

interface GoldenSlot {
  time: string;
  label: string;
  startHour: number;
  endHour: number;
}

const GOLDEN_SLOTS: GoldenSlot[] = [
  { time: '00:00', label: '00:00 Săn Đêm', startHour: 0, endHour: 9 },
  { time: '09:00', label: '09:00 Deal Sáng', startHour: 9, endHour: 12 },
  { time: '12:00', label: '12:00 Giờ Trưa', startHour: 12, endHour: 18 },
  { time: '18:00', label: '18:00 Săn Tối', startHour: 18, endHour: 21 },
  { time: '21:00', label: '21:00 Chốt Đơn', startHour: 21, endHour: 24 },
];

function getLiveSlotIndex(hour: number): number {
  const idx = GOLDEN_SLOTS.findIndex((s) => hour >= s.startHour && hour < s.endHour);
  return idx >= 0 ? idx : 0;
}

export const FlashVoucherBanner: React.FC<FlashVoucherBannerProps> = ({ user, onRequireLogin }) => {
  const [vouchers, setVouchers] = useState<VoucherItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [claimedIds, setClaimedIds] = useState<Set<string>>(new Set());
  const [liveIndex, setLiveIndex] = useState<number>(() => getLiveSlotIndex(new Date().getHours()));
  const [selectedSlotTime, setSelectedSlotTime] = useState<string>(
    () => GOLDEN_SLOTS[getLiveSlotIndex(new Date().getHours())].time
  );
  const [countdown, setCountdown] = useState<string>('00:00:00');

  // Cập nhật khung giờ đang diễn ra & đếm ngược tới cuối ca hiện tại
  useEffect(() => {
    const updateSlotAndCountdown = () => {
      const now = new Date();
      const idx = getLiveSlotIndex(now.getHours());
      const currentSlot = GOLDEN_SLOTS[idx];

      setLiveIndex((prevIdx) => {
        if (prevIdx !== idx) {
          setSelectedSlotTime(currentSlot.time);
        }
        return idx;
      });

      const endTarget = new Date(now);
      if (currentSlot.endHour >= 24) {
        endTarget.setDate(endTarget.getDate() + 1);
        endTarget.setHours(0, 0, 0, 0);
      } else {
        endTarget.setHours(currentSlot.endHour, 0, 0, 0);
      }

      const diffSec = Math.max(0, Math.floor((endTarget.getTime() - now.getTime()) / 1000));
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

  // Lọc voucher toàn sàn hoặc có cờ isClaimable
  const claimableVouchers = useMemo(() => {
    return vouchers.filter((v) => v.shopId === 'PLATFORM' || v.isClaimable);
  }, [vouchers]);

  const liveSlot = GOLDEN_SLOTS[liveIndex] || GOLDEN_SLOTS[0];
  const nextSlot = GOLDEN_SLOTS[(liveIndex + 1) % GOLDEN_SLOTS.length];
  const selectedSlotIndex = Math.max(
    0,
    GOLDEN_SLOTS.findIndex((s) => s.time === selectedSlotTime)
  );
  const selectedSlotObj = GOLDEN_SLOTS[selectedSlotIndex] || liveSlot;
  const selectedSlotState: 'passed' | 'live' | 'upcoming' =
    selectedSlotIndex < liveIndex
      ? 'passed'
      : selectedSlotIndex === liveIndex
      ? 'live'
      : 'upcoming';

  // Hiển thị bộ 3 voucher cân đối cho mỗi ca (quay vòng theo ca từ danh sách voucher thật trong DB)
  const visibleVouchers = useMemo(() => {
    if (claimableVouchers.length <= 3) return claimableVouchers;
    const cardsPerSlot = 3;
    const offset = (selectedSlotIndex * cardsPerSlot) % claimableVouchers.length;
    const result: VoucherItem[] = [];
    for (let i = 0; i < Math.min(cardsPerSlot, claimableVouchers.length); i++) {
      result.push(claimableVouchers[(offset + i) % claimableVouchers.length]);
    }
    return result;
  }, [claimableVouchers, selectedSlotIndex]);

  const handleClaim = async (v: VoucherItem) => {
    if (selectedSlotState !== 'live') return;
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
        body: JSON.stringify({ userId: user.id, voucherId: v.id }),
      });

      if (res.ok) {
        setClaimedIds((prev) => new Set(prev).add(v.id));
        fetchVouchers();
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
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-950 rounded-3xl p-5 sm:p-6 text-white shadow-xl shadow-emerald-950/20 mb-8 overflow-hidden relative selection:bg-white selection:text-emerald-700 text-left">
      <div className="absolute -top-16 -right-16 w-56 h-56 bg-white/10 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-16 w-56 h-56 bg-emerald-400/20 rounded-full blur-2xl pointer-events-none" />

      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/20 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-2xl shadow-inner shrink-0">
            ⚡
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-black tracking-tight text-white uppercase">
                Khung Giờ Vàng Săn Voucher
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 shadow-3xs">
                FCFS Nhanh Tay
              </span>
            </div>
            <p className="text-xs text-emerald-100/90 font-semibold mt-0.5">
              Bấm <strong>"Lưu Vào Ví"</strong> ở ca đang diễn ra • Khi thanh toán, <strong>ai chốt đơn trước được áp dụng trước</strong>!
            </p>
          </div>
        </div>

        {/* Đồng hồ đếm ngược chuẩn xác theo ca đang diễn ra */}
        <div className="flex items-center gap-3 bg-black/25 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/15 shrink-0">
          <div className="text-left">
            <div className="text-[10px] font-black uppercase text-emerald-200 tracking-wider">
              Kết thúc ca {liveSlot.time} sau
            </div>
            <div className="font-mono text-base font-black text-white tracking-widest">
              {countdown}
            </div>
          </div>
          <div className="h-8 w-px bg-white/20" />
          <div className="text-left">
            <div className="text-[10px] text-white/70 font-bold uppercase">Ca kế tiếp</div>
            <div className="text-xs font-black text-amber-300">{nextSlot.time}</div>
          </div>
        </div>
      </div>

      {/* Golden Hour Slots Bar (có thể bấm để xem từng khung giờ) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 my-4 relative z-10">
        {GOLDEN_SLOTS.map((slot, idx) => {
          const isLive = idx === liveIndex;
          const isPassed = idx < liveIndex;
          const isSelected = slot.time === selectedSlotObj.time;

          return (
            <button
              key={slot.time}
              type="button"
              onClick={() => setSelectedSlotTime(slot.time)}
              className={`py-2 px-3 rounded-xl text-center border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-white text-emerald-900 border-white shadow-md font-black'
                  : isLive
                  ? 'bg-emerald-500/30 text-white border-emerald-300/60 font-bold hover:bg-emerald-500/40'
                  : isPassed
                  ? 'bg-black/15 text-white/55 border-white/10 font-semibold hover:bg-black/25'
                  : 'bg-white/10 text-white/85 border-white/15 font-bold hover:bg-white/20'
              }`}
            >
              <div className="text-xs font-black">{slot.label}</div>
              <div className="text-[10px] opacity-90 mt-0.5">
                {isLive ? '⚡ Đang Diễn Ra' : isPassed ? 'Đã Kết Thúc' : 'Sắp Mở'}
              </div>
            </button>
          );
        })}
      </div>

      {/* Voucher Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-1 relative z-10">
        {visibleVouchers.map((v) => {
          const isClaimed = claimedIds.has(v.id);
          const isExhausted = v.usedCount >= v.usageLimit;
          const usagePercent = Math.min(Math.round((v.usedCount / (v.usageLimit || 1)) * 100), 100);
          const isClaiming = claimingId === v.id;
          const canClaim = selectedSlotState === 'live' && !isClaimed && !isExhausted && !isClaiming;

          return (
            <div
              key={`${selectedSlotObj.time}-${v.id}`}
              className="bg-white rounded-2xl p-4 text-slate-800 shadow-md border border-white/40 flex flex-col justify-between relative overflow-hidden transition-all hover:shadow-lg"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-100">
                    Sàn Trợ Giá
                  </span>
                  <span className="font-mono font-black text-xs text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                    {v.code}
                  </span>
                </div>

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

              <div className="mt-4 pt-3 border-t border-slate-100 space-y-2.5">
                <div>
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 mb-1">
                    <span>
                      {isExhausted ? (
                        <strong className="text-rose-600">Đã hết lượt sử dụng</strong>
                      ) : (
                        <span>
                          Đã dùng <strong>{v.usedCount}/{v.usageLimit}</strong> ({usagePercent}%)
                        </span>
                      )}
                    </span>
                    <span className="text-emerald-700 font-black">
                      {isExhausted
                        ? 'HẾT LƯỢT'
                        : `${v.claimedCount || 0} đã lưu • FCFS`}
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

                <button
                  type="button"
                  disabled={!canClaim}
                  onClick={() => handleClaim(v)}
                  className={`w-full py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-3xs ${
                    isClaimed
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default'
                      : selectedSlotState !== 'live' || isExhausted
                      ? 'bg-slate-100 text-slate-500 border border-slate-200 cursor-not-allowed'
                      : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-emerald-600/20 cursor-pointer active:scale-98'
                  }`}
                >
                  {isClaiming ? (
                    <span>Đang lưu...</span>
                  ) : isClaimed ? (
                    <>
                      <span>✅</span>
                      <span>Đã Trong Ví Của Bạn</span>
                    </>
                  ) : isExhausted ? (
                    <span>Đã Hết Suất</span>
                  ) : selectedSlotState === 'upcoming' ? (
                    <span>🕒 Mở Lưu Lúc {selectedSlotObj.time}</span>
                  ) : selectedSlotState === 'passed' ? (
                    <span>Đã Kết Thúc Ca {selectedSlotObj.time}</span>
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
