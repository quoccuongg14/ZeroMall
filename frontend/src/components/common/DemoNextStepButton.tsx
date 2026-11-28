import React, { useEffect, useState } from 'react';
import { API_BASE_URL, getDeliveryPortalUrl, getSellerPortalUrl } from '../../config/api.config';
import {
  clearDemoHelperPin,
  getDemoHelperPin,
  isDemoHelperEnabled,
  subscribeDemoHelper,
} from '../../utils/demoHelperState';

interface NextStepAccount {
  name: string;
  email: string;
  role: string;
  status?: string;
  phone?: string;
  vehicleNumber?: string;
  isAssigned?: boolean;
}

interface NextStepResponse {
  completed: boolean;
  actionGuide: string;
  isCrossSoc: boolean;
  order: {
    id: string;
    invoiceNo?: string;
    shopName?: string | null;
  };
  shipment: {
    trackingNumber: string;
    status: string;
  } | null;
  stage: {
    step: number;
    stageKey: string;
    title: string;
    subtitle: string;
    locationLabel: string;
    portal: 'seller' | 'delivery';
    note?: string;
    accounts: NextStepAccount[];
  };
}

interface DemoNextStepButtonProps {
  identifier: string;
  portal?: 'buyer' | 'seller' | 'delivery' | 'driver';
  hubId?: string;
  compact?: boolean;
}

export const DemoNextStepButton: React.FC<DemoNextStepButtonProps> = ({
  identifier,
  portal = 'buyer',
  hubId,
  compact = false,
}) => {
  const [enabled, setEnabled] = useState<boolean>(() => isDemoHelperEnabled());
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<NextStepResponse | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    setEnabled(isDemoHelperEnabled());
    return subscribeDemoHelper(() => setEnabled(isDemoHelperEnabled()));
  }, []);

  if (!enabled || !identifier) return null;

  const handleOpen = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const pin = getDemoHelperPin();
    if (!pin) return;

    setIsOpen(true);
    setLoading(true);
    setError(null);

    try {
      const qs = new URLSearchParams();
      if (portal) qs.set('portal', portal);
      if (hubId) qs.set('hubId', hubId);
      const res = await fetch(
        `${API_BASE_URL}/delivery/route-accounts/next-step/${encodeURIComponent(identifier)}?${qs.toString()}`,
        { headers: { 'x-demo-pin': pin } },
      );
      if (res.status === 403) {
        clearDemoHelperPin();
        throw new Error('Mã PIN không hợp lệ hoặc đã hết hiệu lực.');
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Không lấy được gợi ý bước tiếp theo.');
      }
      const data: NextStepResponse = await res.json();
      setHint(data);
    } catch (err: any) {
      setError(err.message || 'Lỗi kết nối.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (email: string, key: string) => {
    navigator.clipboard.writeText(email).catch(() => {});
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 1500);
  };

  const openTargetPortal = (target: 'seller' | 'delivery') => {
    const url = target === 'seller' ? getSellerPortalUrl() : getDeliveryPortalUrl();
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        title="Gợi ý bước tiếp theo & tài khoản cần đăng nhập cho đơn này"
        className={`inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold transition cursor-pointer shrink-0 ${
          compact ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1 text-[11px]'
        }`}
      >
        <span>💡</span>
        <span>Bước tiếp</span>
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-[110] bg-slate-950/50 backdrop-blur-2xs flex items-center justify-center p-4"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(false);
          }}
        >
          <div
            className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden text-left text-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">💡</span>
                <div>
                  <h4 className="text-xs font-black tracking-wide">Bước Tiếp Theo Cần Làm</h4>
                  <p className="text-[10px] text-slate-400 font-mono">
                    {hint?.shipment?.trackingNumber || hint?.order?.invoiceNo || identifier}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="p-4 space-y-3 text-xs">
              {loading ? (
                <div className="py-8 text-center text-slate-400">Đang kiểm tra bước tiếp theo...</div>
              ) : error ? (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 font-semibold">
                  {error}
                </div>
              ) : hint ? (
                <>
                  <div
                    className={`p-3 rounded-xl border ${
                      hint.completed
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        : 'bg-indigo-50/70 border-indigo-200 text-indigo-950'
                    }`}
                  >
                    <p className="font-bold leading-relaxed">{hint.actionGuide}</p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-black text-slate-900">
                        Chặng {hint.stage.step}: {hint.stage.title}
                      </span>
                      <button
                        type="button"
                        onClick={() => openTargetPortal(hint.stage.portal)}
                        className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-bold cursor-pointer shrink-0"
                      >
                        {hint.stage.portal === 'seller' ? 'Mở Seller ↗' : 'Mở Giao Vận ↗'}
                      </button>
                    </div>
                    <p className="text-[11px] font-semibold text-slate-700">{hint.stage.subtitle}</p>
                    {hint.stage.locationLabel && (
                      <p className="text-[10px] text-slate-500">📍 {hint.stage.locationLabel}</p>
                    )}
                  </div>

                  {hint.stage.note && (
                    <p className="text-[10px] text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-lg">
                      {hint.stage.note}
                    </p>
                  )}

                  <div className="space-y-1.5">
                    {hint.stage.accounts.length === 0 ? (
                      <p className="text-[11px] italic text-slate-400">
                        Chưa tìm thấy tài khoản gán trực tiếp ở chặng này.
                      </p>
                    ) : (
                      hint.stage.accounts.map((acc, idx) => {
                        const key = `next-${idx}`;
                        const canCopy = acc.email && !acc.email.startsWith('(');
                        return (
                          <div
                            key={key}
                            className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-slate-900 text-[11px]">{acc.name}</span>
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                                  {acc.role}
                                </span>
                                {acc.isAssigned && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                                    Đang giữ đơn
                                  </span>
                                )}
                                {acc.status && (
                                  <span
                                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                      acc.status === 'OFFLINE'
                                        ? 'bg-rose-100 text-rose-700'
                                        : 'bg-emerald-50 text-emerald-700'
                                    }`}
                                  >
                                    {acc.status}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] font-mono text-indigo-700 truncate mt-0.5">
                                {acc.email}
                                {acc.phone ? ` • ${acc.phone}` : ''}
                              </p>
                            </div>

                            {canCopy && (
                              <button
                                type="button"
                                onClick={() => handleCopy(acc.email, key)}
                                className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 hover:border-indigo-500 text-[10px] font-bold text-slate-700 cursor-pointer shrink-0"
                              >
                                {copiedKey === key ? '✓ Đã chép' : 'Copy Email'}
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              ) : null}

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    window.dispatchEvent(new CustomEvent('zm:open-route-inspector'));
                  }}
                  className="hover:text-indigo-600 font-semibold cursor-pointer"
                >
                  Xem bảng tổng 7 chặng →
                </button>
                <button
                  type="button"
                  onClick={() => {
                    clearDemoHelperPin();
                    setIsOpen(false);
                  }}
                  className="hover:text-rose-600 font-semibold cursor-pointer"
                >
                  Tắt nút gợi ý ẩn
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
