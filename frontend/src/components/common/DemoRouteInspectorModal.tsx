import React, { useEffect, useState, useCallback } from 'react';
import { API_BASE_URL, getDeliveryPortalUrl, getSellerPortalUrl } from '../../config/api.config';
import {
  clearDemoHelperPin,
  getDemoHelperPin,
  setDemoHelperPin,
} from '../../utils/demoHelperState';

interface RouteAccountInfo {
  name: string;
  email: string;
  role: string;
  status?: string;
  phone?: string;
  vehicleType?: string;
  vehicleNumber?: string;
  operatingArea?: string;
  isAssigned?: boolean;
}

interface RouteStageSummary {
  stageKey:
    | 'SELLER'
    | 'PICKUP_DRIVER'
    | 'ORIGIN_HUB'
    | 'ORIGIN_SOC'
    | 'DEST_SOC'
    | 'DEST_HUB'
    | 'DELIVERY_DRIVER';
  step: number;
  title: string;
  subtitle: string;
  locationLabel: string;
  hubCode?: string;
  hubName?: string;
  hubType?: string;
  portal: 'seller' | 'delivery';
  note?: string;
  accounts: RouteAccountInfo[];
}

interface TraceResult {
  order: {
    id: string;
    invoiceNo?: string;
    orderStatus: string;
    totalAmount: number;
    paymentMethod: string;
    buyerName: string;
    buyerEmail: string;
    shippingAddress: string;
    createdAt: string;
    shopName?: string | null;
  };
  shipment: {
    id: string;
    trackingNumber: string;
    status: string;
    currentHubCode?: string | null;
    currentHubName?: string | null;
  } | null;
  isCrossSoc: boolean;
  stages: RouteStageSummary[];
}

interface OrderSummary {
  id: string;
  invoiceNo?: string;
  buyerName: string;
  shopName?: string;
  orderStatus: string;
  shipmentStatus?: string;
  trackingNumber?: string;
  totalAmount: number;
  createdAt: string;
}

function getActiveStepNumber(trace: TraceResult): number {
  const spStatus = trace.shipment?.status;
  if (!spStatus) return 1;
  switch (spStatus) {
    case 'CREATED':
    case 'WAITING_PICKUP':
    case 'PICKUP_ASSIGNED':
    case 'PICKING_UP':
      return 2;
    case 'PICKED_UP':
    case 'AT_ORIGIN_HUB':
      return 3;
    case 'SORTING':
      return 4;
    case 'IN_TRANSIT':
      return trace.isCrossSoc ? 5 : 6;
    case 'AT_DESTINATION_HUB':
      return 6;
    case 'OUT_FOR_DELIVERY':
    case 'DELIVERY_ASSIGNED':
    case 'DELIVERED':
      return 7;
    default:
      return 1;
  }
}

export const DemoRouteInspectorModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [pin, setPin] = useState<string>(() => getDemoHelperPin());
  const [pinInput, setPinInput] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);

  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [trace, setTrace] = useState<TraceResult | null>(null);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingTrace, setLoadingTrace] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const fetchOrders = useCallback(async (activePin: string, query = '') => {
    setLoadingOrders(true);
    setErrorMsg(null);
    try {
      const qs = query.trim() ? `?search=${encodeURIComponent(query.trim())}` : '';
      const res = await fetch(`${API_BASE_URL}/delivery/route-accounts/orders${qs}`, {
        headers: { 'x-demo-pin': activePin },
      });
      if (res.status === 403) {
        setIsUnlocked(false);
        clearDemoHelperPin();
        throw new Error('Mã PIN không chính xác.');
      }
      if (!res.ok) throw new Error('Không tải được danh sách đơn hàng.');
      const data: OrderSummary[] = await res.json();
      setIsUnlocked(true);
      setDemoHelperPin(activePin);
      setOrders(data);
      if (data.length > 0 && !selectedOrderId) {
        setSelectedOrderId(data[0].id);
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Lỗi kết nối.');
    } finally {
      setLoadingOrders(false);
    }
  }, [selectedOrderId]);

  const fetchTrace = useCallback(async (activePin: string, identifier: string) => {
    if (!identifier) return;
    setLoadingTrace(true);
    setErrorMsg(null);
    try {
      const res = await fetch(
        `${API_BASE_URL}/delivery/route-accounts/trace/${encodeURIComponent(identifier)}`,
        { headers: { 'x-demo-pin': activePin } },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Không tra cứu được lộ trình đơn hàng.');
      }
      const data: TraceResult = await res.json();
      setTrace(data);
    } catch (e: any) {
      setErrorMsg(e.message || 'Lỗi tra cứu lộ trình.');
    } finally {
      setLoadingTrace(false);
    }
  }, []);

  // Kích hoạt ẩn: Option/Alt + Shift + D hoặc CustomEvent từ footer
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.shiftKey && (e.code === 'KeyD' || e.key.toLowerCase() === 'd')) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    const onCustomOpen = () => setIsOpen(true);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('zm:open-route-inspector', onCustomOpen);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('zm:open-route-inspector', onCustomOpen);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && pin && !isUnlocked) {
      fetchOrders(pin, searchTerm);
    } else if (isOpen && isUnlocked) {
      fetchOrders(pin, searchTerm);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && isUnlocked && pin && selectedOrderId) {
      fetchTrace(pin, selectedOrderId);
    }
  }, [isOpen, isUnlocked, pin, selectedOrderId, fetchTrace]);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = pinInput.trim();
    if (!cleaned) return;
    setPin(cleaned);
    fetchOrders(cleaned, '');
  };

  const handleCopyEmail = (email: string, idKey: string) => {
    navigator.clipboard.writeText(email).catch(() => {});
    setCopiedKey(idKey);
    setTimeout(() => setCopiedKey((prev) => (prev === idKey ? null : prev)), 1500);
  };

  const openPortal = (portal: 'seller' | 'delivery') => {
    const url = portal === 'seller' ? getSellerPortalUrl() : getDeliveryPortalUrl();
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (!isOpen) return null;

  const activeStep = trace ? getActiveStepNumber(trace) : 0;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white w-full max-w-5xl max-h-[90vh] rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden text-slate-800">
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="text-lg">🧭</span>
            <div>
              <h3 className="text-sm font-black tracking-wide">Route & Account Inspector (Hidden Support)</h3>
              <p className="text-[11px] text-slate-400">Phím tắt: Option/Alt + Shift + D • Đóng: Esc</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isUnlocked && (
              <button
                type="button"
                onClick={() => {
                  clearDemoHelperPin();
                  setPin('');
                  setIsUnlocked(false);
                  setIsOpen(false);
                }}
                className="px-2.5 py-1 rounded-lg bg-rose-500/80 hover:bg-rose-500 text-white text-[11px] font-bold cursor-pointer transition"
              >
                Tắt gợi ý
              </button>
            )}
            <button
              type="button"
              onClick={() => openPortal('seller')}
              className="px-2.5 py-1 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 text-white text-[11px] font-bold cursor-pointer transition"
            >
              Mở Seller ↗
            </button>
            <button
              type="button"
              onClick={() => openPortal('delivery')}
              className="px-2.5 py-1 rounded-lg bg-sky-600/90 hover:bg-sky-500 text-white text-[11px] font-bold cursor-pointer transition"
            >
              Mở Giao Vận ↗
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-bold cursor-pointer transition"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        {!isUnlocked ? (
          <form onSubmit={handleUnlock} className="p-8 flex flex-col items-center justify-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-2xl">🔐</div>
            <div className="text-center space-y-1">
              <h4 className="text-sm font-bold text-slate-900">Xác Thực Công Cụ Hỗ Trợ Nội Bộ</h4>
              <p className="text-xs text-slate-500">Nhập mã PIN bảo mật (`DEMO_HELPER_PIN` trong `.env`)</p>
            </div>
            {errorMsg && (
              <div className="px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 text-xs font-semibold">
                {errorMsg}
              </div>
            )}
            <div className="flex gap-2 w-full max-w-xs">
              <input
                type="password"
                autoFocus
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="Nhập mã PIN..."
                className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:border-slate-900"
              />
              <button
                type="submit"
                disabled={loadingOrders}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                Mở khóa
              </button>
            </div>
          </form>
        ) : (
          <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12">
            {/* Left Sidebar: Recent Orders */}
            <div className="md:col-span-4 border-b md:border-b-0 md:border-r border-slate-200 flex flex-col bg-slate-50/70 max-h-[240px] md:max-h-full overflow-hidden">
              <div className="p-3 border-b border-slate-200 flex gap-1.5 bg-white">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchOrders(pin, searchTerm)}
                  placeholder="Tìm mã đơn, SPX, Shop, Buyer..."
                  className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:border-slate-400"
                />
                <button
                  type="button"
                  onClick={() => fetchOrders(pin, searchTerm)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-900 text-white text-[11px] font-bold cursor-pointer"
                >
                  {loadingOrders ? '...' : 'Tìm'}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-slate-200/70">
                {orders.map((ord) => {
                  const selected = ord.id === selectedOrderId;
                  return (
                    <button
                      key={ord.id}
                      type="button"
                      onClick={() => setSelectedOrderId(ord.id)}
                      className={`w-full text-left p-3 transition cursor-pointer ${
                        selected ? 'bg-indigo-50 border-l-4 border-l-indigo-600' : 'hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[11px] font-black text-slate-900 truncate">
                          {ord.trackingNumber || ord.invoiceNo || ord.id.slice(0, 8)}
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 shrink-0">
                          {ord.shipmentStatus || ord.orderStatus}
                        </span>
                      </div>
                      <p className="text-[11px] font-semibold text-indigo-700 truncate mt-0.5">
                        🏪 {ord.shopName || 'Shop chưa rõ'}
                      </p>
                      <p className="text-[10px] text-slate-500 truncate">
                        👤 {ord.buyerName} • {Number(ord.totalAmount || 0).toLocaleString('vi-VN')}đ
                      </p>
                    </button>
                  );
                })}
                {orders.length === 0 && !loadingOrders && (
                  <p className="p-4 text-center text-xs text-slate-400">Không có đơn hàng khớp.</p>
                )}
              </div>
            </div>

            {/* Right Panel: 7-Stage Account Roadmap */}
            <div className="md:col-span-8 overflow-y-auto p-4 space-y-3 bg-white">
              {errorMsg && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-semibold">
                  {errorMsg}
                </div>
              )}

              {loadingTrace ? (
                <div className="py-12 text-center text-xs text-slate-400">Đang truy vết 7 chặng tài khoản...</div>
              ) : trace ? (
                <>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="space-y-0.5">
                      <div className="font-black text-slate-900 flex items-center gap-2 flex-wrap">
                        <span>Đơn: {trace.order.invoiceNo || trace.order.id.slice(0, 8)}</span>
                        {trace.shipment?.trackingNumber && (
                          <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                            {trace.shipment.trackingNumber}
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-bold text-[11px]">
                          {trace.shipment?.status || trace.order.orderStatus}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Khách: <b>{trace.order.buyerName}</b> • Giao tới: {trace.order.shippingAddress}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => fetchTrace(pin, trace.order.id)}
                      className="px-2.5 py-1 rounded-lg border border-slate-300 hover:bg-slate-100 text-[11px] font-bold cursor-pointer"
                    >
                      🔄 Làm mới chặng
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {trace.stages.map((st) => {
                      const isCurrent = st.step === activeStep;
                      return (
                        <div
                          key={st.stageKey}
                          className={`rounded-xl border p-3 transition ${
                            isCurrent
                              ? 'border-indigo-400 bg-indigo-50/40 shadow-xs'
                              : 'border-slate-200 bg-white'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span
                                  className={`w-5 h-5 rounded-full text-[11px] font-black flex items-center justify-center ${
                                    isCurrent ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'
                                  }`}
                                >
                                  {st.step}
                                </span>
                                <h4 className="text-xs font-black text-slate-900">{st.title}</h4>
                                {isCurrent && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-600 text-white">
                                    Chặng hiện tại
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] font-semibold text-slate-700 mt-1">{st.subtitle}</p>
                              {st.locationLabel && (
                                <p className="text-[10px] text-slate-500">📍 {st.locationLabel}</p>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => openPortal(st.portal)}
                              className="text-[10px] font-bold px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 shrink-0 cursor-pointer"
                            >
                              {st.portal === 'seller' ? 'Vào Seller ↗' : 'Vào Giao Vận ↗'}
                            </button>
                          </div>

                          {st.note && (
                            <p className="mt-1.5 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg">
                              {st.note}
                            </p>
                          )}

                          <div className="mt-2 space-y-1.5">
                            {st.accounts.length === 0 ? (
                              <p className="text-[11px] italic text-slate-400">
                                Chưa có tài khoản gán trực tiếp ở chặng này.
                              </p>
                            ) : (
                              st.accounts.map((acc, idx) => {
                                const cKey = `${st.stageKey}-${idx}`;
                                const canCopy = acc.email && !acc.email.startsWith('(');
                                return (
                                  <div
                                    key={cKey}
                                    className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 border border-slate-200/80 rounded-lg px-2.5 py-1.5"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-[11px] font-bold text-slate-800">{acc.name}</span>
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
                                      <div className="text-[11px] font-mono text-indigo-700 truncate">
                                        {acc.email}
                                        {acc.phone ? ` • ${acc.phone}` : ''}
                                        {acc.vehicleNumber ? ` • ${acc.vehicleNumber}` : ''}
                                      </div>
                                    </div>

                                    {canCopy && (
                                      <button
                                        type="button"
                                        onClick={() => handleCopyEmail(acc.email, cKey)}
                                        className="px-2.5 py-1 rounded-md bg-white border border-slate-300 hover:border-indigo-500 text-[10px] font-bold text-slate-700 cursor-pointer shrink-0"
                                      >
                                        {copiedKey === cKey ? '✓ Đã chép' : 'Copy Email'}
                                      </button>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="py-12 text-center text-xs text-slate-400">
                  Chọn 1 đơn hàng ở cột bên trái để xem đủ 7 chặng tài khoản.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
