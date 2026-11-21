import React, { useState, useMemo, useEffect } from 'react';
import { formatOrderId } from '../../../utils/orderUtils';

interface FinancialDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'GMV' | 'COMMISSION';
  filteredOrders: any[];
  validGmvOrders: any[];
  totalGMV: number;
  totalCommission: number;
  pendingCommissionCard: number;
  completedOrdersForComm: any[];
  heldOrdersForComm: any[];
  filterLabel: string;
}

export const FinancialDetailModal: React.FC<FinancialDetailModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'GMV',
  filteredOrders,
  validGmvOrders,
  totalGMV,
  totalCommission,
  pendingCommissionCard,
  completedOrdersForComm,
  heldOrdersForComm,
  filterLabel,
}) => {
  const [activeTab, setActiveTab] = useState<'GMV' | 'COMMISSION'>(initialTab);
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('ALL');
  const [commTabFilter, setCommTabFilter] = useState<'EARNED' | 'PENDING' | 'IN_TRANSIT' | 'REFUNDED'>('EARNED');

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Đóng modal khi bấm phím ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const getOrderItemSubtotal = (o: any) => {
    if (o.items && Array.isArray(o.items) && o.items.length > 0) {
      return o.items.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0);
    }
    return Math.max(0, (o.totalAmount || 0) - (o.shippingFee || 0));
  };

  const getOrderCommRate = (o: any) => o.commissionRate ?? 5;
  const getOrderCommAmount = (o: any) => {
    const itemSubtotal = getOrderItemSubtotal(o);
    const shopDiscount = o.shopDiscountAmount || 0;
    const netSubtotal = Math.max(0, itemSubtotal - shopDiscount);
    return Math.round(netSubtotal * (getOrderCommRate(o) / 100));
  };

  // Phân bổ thanh toán
  const paymentDistribution = useMemo(() => {
    const methods = ['cod', 'zeropay', 'sepay'];
    const methodLabels: Record<string, string> = {
      cod: 'Thanh toán COD',
      zeropay: 'Ví điện tử ZeroPay',
      sepay: 'Chuyển khoản VietQR',
    };
    return methods
      .map((m) => {
        const ordersForMethod = validGmvOrders.filter((o) => o.paymentMethod?.toLowerCase() === m);
        const sum = ordersForMethod.reduce((s, o) => s + getOrderItemSubtotal(o), 0);
        const count = ordersForMethod.length;
        const pct = totalGMV > 0 ? (sum / totalGMV) * 100 : 0;
        return { method: m, label: methodLabels[m] || m, sum, count, pct };
      })
      .sort((a, b) => b.sum - a.sum);
  }, [validGmvOrders, totalGMV]);

  // Tìm kiếm và lọc danh sách đơn hàng
  const searchFilteredOrders = useMemo(() => {
    return filteredOrders.filter((o) => {
      const q = orderSearchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        o.id?.toLowerCase().includes(q) ||
        o.buyerEmail?.toLowerCase().includes(q) ||
        o.buyerName?.toLowerCase().includes(q);

      const matchStatus = orderStatusFilter === 'ALL' || o.status === orderStatusFilter;
      return matchQuery && matchStatus;
    });
  }, [filteredOrders, orderSearchQuery, orderStatusFilter]);

  // Dữ liệu cho tab Commission
  const completedOrders = useMemo(() => filteredOrders.filter((o) => o.status === 'COMPLETED'), [filteredOrders]);
  const pendingOrders = useMemo(() => filteredOrders.filter((o) => o.status === 'DELIVERED'), [filteredOrders]);
  const inTransitOrders = useMemo(
    () =>
      filteredOrders.filter(
        (o) =>
          o.status === 'PROCESSING' ||
          o.status === 'SHIPPED' ||
          o.status === 'SHIPPING' ||
          o.status === 'DELIVERING' ||
          o.status === 'IN_TRANSIT' ||
          o.status === 'PENDING' ||
          o.status === 'PENDING_PAYMENT'
      ),
    [filteredOrders]
  );
  const refundedOrders = useMemo(
    () =>
      filteredOrders.filter(
        (o) =>
          o.status === 'REFUNDED' ||
          o.status === 'RETURNED' ||
          o.status === 'REFUND_PENDING' ||
          o.status === 'RETURN_PENDING' ||
          o.status === 'REFUND_DISPUTED'
      ),
    [filteredOrders]
  );

  const displayedCommOrders = useMemo(() => {
    switch (commTabFilter) {
      case 'EARNED':
        return completedOrders;
      case 'PENDING':
        return pendingOrders;
      case 'IN_TRANSIT':
        return inTransitOrders;
      case 'REFUNDED':
        return refundedOrders;
    }
  }, [commTabFilter, completedOrders, pendingOrders, inTransitOrders, refundedOrders]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/65 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-white border border-slate-200/90 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden text-left font-sans animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📊</span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black uppercase tracking-wide text-white">
                  Báo Cáo Dòng Tiền & Tra Cứu Giao Dịch Chi Tiết
                </h3>
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-2 py-0.5 rounded">
                  Kỳ lọc: {filterLabel}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                Dữ liệu tài chính, phân bổ phương thức thanh toán và danh sách đơn hàng thực tế
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* TABS SWITCHER TRONG MODAL */}
            <div className="flex bg-slate-800 p-0.5 rounded-xl border border-slate-700 text-xs font-bold">
              <button
                onClick={() => setActiveTab('GMV')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer select-none flex items-center gap-1.5 ${
                  activeTab === 'GMV'
                    ? 'bg-emerald-600 text-white shadow-2xs font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>🌱</span> Chi Tiết GMV & Đơn Hàng
              </button>
              <button
                onClick={() => setActiveTab('COMMISSION')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer select-none flex items-center gap-1.5 ${
                  activeTab === 'COMMISSION'
                    ? 'bg-violet-600 text-white shadow-2xs font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>💰</span> Đối Soát Chiết Khấu Sàn
              </button>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center font-bold text-sm cursor-pointer transition"
              title="Đóng (ESC)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* MODAL BODY (SCROLLABLE) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/40">
          {/* TAB 1: GMV VÀ TOÀN BỘ ĐƠN HÀNG */}
          {activeTab === 'GMV' && (
            <div className="space-y-6">
              {/* Tóm tắt dòng tiền */}
              <div className="bg-emerald-500/[0.04] border border-emerald-500/20 rounded-xl p-4 flex flex-wrap justify-between items-center gap-4">
                <div>
                  <h5 className="text-[10px] font-black text-emerald-800 uppercase tracking-wider">
                    Tổng Doanh Số GMV Đang Xử Lý & Hoàn Tất Trong Kỳ
                  </h5>
                  <p className="text-[11px] text-slate-600 font-bold mt-0.5">
                    Đã thanh toán thực tế: <span className="text-emerald-700 font-black">{totalGMV.toLocaleString('vi-VN')}đ</span> ({validGmvOrders.length} đơn hợp lệ) • {completedOrdersForComm.length} đơn Completed • {heldOrdersForComm.length} đơn Delivered
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs font-bold">
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Thực thu sàn (Completed):</span>
                    <span className="text-base font-black text-violet-700">+{Math.round(totalCommission).toLocaleString('vi-VN')}đ</span>
                  </div>
                  {pendingCommissionCard > 0 && (
                    <div className="text-right border-l border-slate-200 pl-4">
                      <span className="text-[10px] text-amber-500 uppercase font-semibold block">Tạm giữ 7 ngày:</span>
                      <span className="text-base font-black text-amber-600">+{Math.round(pendingCommissionCard).toLocaleString('vi-VN')}đ</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 2 Cột: Phân bổ thanh toán & Top đơn */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-2xs space-y-4">
                  <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <span>💳</span> Phân Bổ Kênh Thanh Toán (Đơn Hợp Lệ)
                  </h5>
                  <div className="space-y-3.5">
                    {paymentDistribution.map((item) => (
                      <div key={item.method} className="space-y-1 text-xs">
                        <div className="flex justify-between font-bold text-slate-700">
                          <span>{item.label} ({item.count} đơn)</span>
                          <span>{item.sum.toLocaleString('vi-VN')}đ ({item.pct.toFixed(1)}%)</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                            style={{ width: `${item.pct}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-2xs space-y-4">
                  <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <span>🏆</span> Top 5 Đơn Hàng Giá Trị Cao Nhất
                  </h5>
                  <div className="divide-y divide-slate-100">
                    {[...validGmvOrders]
                      .sort((a, b) => getOrderItemSubtotal(b) - getOrderItemSubtotal(a))
                      .slice(0, 5)
                      .map((order, idx) => {
                        const subtotal = getOrderItemSubtotal(order);
                        return (
                          <div key={order.id} className="py-2.5 flex justify-between items-center text-xs">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center font-bold text-[10px] text-slate-500">
                                {idx + 1}
                              </span>
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-800 font-mono">#{formatOrderId(order.id)}</span>
                                <span className="text-[9px] text-slate-400 font-semibold">{order.buyerEmail}</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-extrabold text-slate-800">{subtotal.toLocaleString('vi-VN')}đ</p>
                              <span className="text-[8px] font-bold text-slate-400 uppercase">{order.paymentMethod}</span>
                            </div>
                          </div>
                        );
                      })}
                    {validGmvOrders.length === 0 && (
                      <p className="text-xs text-slate-400 font-bold py-4 text-center">Chưa có dữ liệu đơn hàng hợp lệ</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Bảng Danh Sách Toàn Bộ Đơn Hàng */}
              <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-2xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <h5 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <span>📦</span> Danh Sách Toàn Bộ Đơn Hàng Phát Sinh ({searchFilteredOrders.length} đơn)
                    </h5>
                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                      Tra cứu mã đơn, tài khoản người mua và dòng tiền từng giao dịch
                    </p>
                  </div>

                  <div className="flex items-center gap-2.5">
                    {/* Ô Tìm kiếm */}
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Tìm mã đơn, email người mua..."
                        value={orderSearchQuery}
                        onChange={(e) => setOrderSearchQuery(e.target.value)}
                        className="text-xs font-medium pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg w-60 focus:outline-none focus:border-emerald-600"
                      />
                      <span className="absolute left-2.5 top-2 text-slate-400 text-xs">🔍</span>
                    </div>

                    {/* Bộ lọc trạng thái */}
                    <select
                      value={orderStatusFilter}
                      onChange={(e) => setOrderStatusFilter(e.target.value)}
                      className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-emerald-600 cursor-pointer"
                    >
                      <option value="ALL">Tất cả trạng thái</option>
                      <option value="COMPLETED">COMPLETED (Hoàn tất)</option>
                      <option value="DELIVERED">DELIVERED (Đã giao)</option>
                      <option value="SHIPPING">SHIPPING (Đang giao)</option>
                      <option value="PROCESSING">PROCESSING (Đang xử lý)</option>
                      <option value="CANCELLED">CANCELLED (Đã hủy)</option>
                      <option value="REFUNDED">REFUNDED (Đã hoàn tiền)</option>
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[360px]">
                  <table className="w-full text-xs text-left text-slate-700">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase text-[9px] tracking-wider bg-slate-50/70 sticky top-0 z-10">
                        <th className="py-2.5 px-3">Mã đơn hàng</th>
                        <th className="py-2.5 px-3">Thời gian đặt</th>
                        <th className="py-2.5 px-3">Người mua</th>
                        <th className="py-2.5 px-3">Phương thức</th>
                        <th className="py-2.5 px-3">Trạng thái</th>
                        <th className="py-2.5 px-3 text-right">Tổng tiền</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {searchFilteredOrders.map((order) => (
                        <tr key={order.id} className="hover:bg-slate-50/60 transition">
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-800 font-bold">
                            #{formatOrderId(order.id)}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                            {new Date(order.createdAt).toLocaleString('vi-VN')}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-700">
                            {order.buyerName || order.buyerEmail}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[10px] text-slate-500 uppercase">
                            {order.paymentMethod}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase ${
                                order.status === 'COMPLETED'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : order.status === 'SHIPPING' || order.status === 'DELIVERED'
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : order.status === 'CANCELLED'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {order.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-black text-slate-800">
                            {getOrderItemSubtotal(order).toLocaleString('vi-VN')}đ
                          </td>
                        </tr>
                      ))}
                      {searchFilteredOrders.length === 0 && (
                        <tr>
                          <td colSpan={6} className="text-center py-8 text-slate-400 font-bold text-xs">
                            Không tìm thấy đơn hàng nào phù hợp với bộ lọc
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ĐỐI SOÁT CHIẾT KHẤU SÀN */}
          {activeTab === 'COMMISSION' && (
            <div className="space-y-6">
              {/* 4 Thẻ Phân Bổ Chiết Khấu */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                <div
                  onClick={() => setCommTabFilter('EARNED')}
                  className={`border rounded-xl p-4 shadow-2xs cursor-pointer transition ${
                    commTabFilter === 'EARNED'
                      ? 'bg-emerald-50/40 border-emerald-500 ring-2 ring-emerald-500/20'
                      : 'bg-white border-slate-200/70 hover:border-slate-350'
                  }`}
                >
                  <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider flex items-center gap-1">
                    <span>✓</span> Đã Thu (Completed)
                  </p>
                  <p className="text-xl font-black text-emerald-700 mt-1">{completedOrders.length} đơn</p>
                  <p className="text-xs font-black text-emerald-600 mt-0.5">
                    {Math.round(completedOrders.reduce((s, o) => s + getOrderCommAmount(o), 0)).toLocaleString('vi-VN')}đ
                  </p>
                </div>

                <div
                  onClick={() => setCommTabFilter('PENDING')}
                  className={`border rounded-xl p-4 shadow-2xs cursor-pointer transition ${
                    commTabFilter === 'PENDING'
                      ? 'bg-amber-50/40 border-amber-500 ring-2 ring-amber-500/20'
                      : 'bg-white border-slate-200/70 hover:border-slate-350'
                  }`}
                >
                  <p className="text-[10px] text-amber-600 font-bold uppercase tracking-wider flex items-center gap-1">
                    <span>⏳</span> Tạm Giữ (Delivered)
                  </p>
                  <p className="text-xl font-black text-amber-700 mt-1">{pendingOrders.length} đơn</p>
                  <p className="text-xs font-black text-amber-600 mt-0.5">
                    {Math.round(pendingOrders.reduce((s, o) => s + getOrderCommAmount(o), 0)).toLocaleString('vi-VN')}đ
                  </p>
                </div>

                <div
                  onClick={() => setCommTabFilter('IN_TRANSIT')}
                  className={`border rounded-xl p-4 shadow-2xs cursor-pointer transition ${
                    commTabFilter === 'IN_TRANSIT'
                      ? 'bg-blue-50/40 border-blue-500 ring-2 ring-blue-500/20'
                      : 'bg-white border-slate-200/70 hover:border-slate-350'
                  }`}
                >
                  <p className="text-[10px] text-blue-600 font-bold uppercase tracking-wider flex items-center gap-1">
                    <span>🚚</span> Đang Giao Hàng
                  </p>
                  <p className="text-xl font-black text-blue-700 mt-1">{inTransitOrders.length} đơn</p>
                  <p className="text-xs font-black text-blue-600 mt-0.5">
                    {Math.round(inTransitOrders.reduce((s, o) => s + getOrderCommAmount(o), 0)).toLocaleString('vi-VN')}đ
                  </p>
                </div>

                <div
                  onClick={() => setCommTabFilter('REFUNDED')}
                  className={`border rounded-xl p-4 shadow-2xs cursor-pointer transition ${
                    commTabFilter === 'REFUNDED'
                      ? 'bg-rose-50/40 border-rose-500 ring-2 ring-rose-500/20'
                      : 'bg-white border-slate-200/70 hover:border-slate-350'
                  }`}
                >
                  <p className="text-[10px] text-rose-600 font-bold uppercase tracking-wider flex items-center gap-1">
                    <span>↩</span> Đã Hoàn Trả
                  </p>
                  <p className="text-xl font-black text-rose-700 mt-1">{refundedOrders.length} đơn</p>
                  <p className="text-xs font-black text-rose-600 mt-0.5">
                    {Math.round(refundedOrders.reduce((s, o) => s + getOrderCommAmount(o), 0)).toLocaleString('vi-VN')}đ
                  </p>
                </div>
              </div>

              {/* Bảng Chi Tiết Đơn Hàng Theo Trạng Thái Chiết Khấu */}
              <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-2xs space-y-4">
                <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
                  <h5 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                    Danh Sách Đơn Hàng ({displayedCommOrders.length} đơn)
                  </h5>
                  <span className="text-[10px] font-bold text-violet-700 bg-violet-50 px-2 py-0.5 rounded uppercase">
                    Chế độ: {commTabFilter}
                  </span>
                </div>

                <div className="overflow-x-auto max-h-[360px]">
                  <table className="w-full text-xs text-left text-slate-700">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase text-[9px] tracking-wider bg-slate-50/70 sticky top-0 z-10">
                        <th className="py-2.5 px-3">Mã đơn</th>
                        <th className="py-2.5 px-3">Ngày đặt</th>
                        <th className="py-2.5 px-3">Khách hàng</th>
                        <th className="py-2.5 px-3">Giá trị hàng</th>
                        <th className="py-2.5 px-3">Tỷ lệ phí</th>
                        <th className="py-2.5 px-3 text-right">Chiết khấu sàn</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {displayedCommOrders.map((order) => {
                        const subtotal = getOrderItemSubtotal(order);
                        const rate = getOrderCommRate(order);
                        const comm = getOrderCommAmount(order);
                        return (
                          <tr key={order.id} className="hover:bg-slate-50/60 transition">
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                              #{formatOrderId(order.id)}
                            </td>
                            <td className="py-2.5 px-3 text-slate-500">
                              {new Date(order.createdAt).toLocaleDateString('vi-VN')}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-700 truncate max-w-[120px]">
                              {order.buyerName || order.buyerEmail}
                            </td>
                            <td className="py-2.5 px-3 font-bold text-slate-800">
                              {subtotal.toLocaleString('vi-VN')}đ
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-violet-50 text-violet-700 border border-violet-100">
                                {rate}%
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-black text-violet-700">
                              +{comm.toLocaleString('vi-VN')}đ
                            </td>
                          </tr>
                        );
                      })}
                      {displayedCommOrders.length === 0 && (
                        <tr>
                          <td colSpan={6} className="text-center py-8 text-slate-400 font-bold text-xs">
                            Không có đơn hàng nào trong phân loại này
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="bg-white border-t border-slate-100 px-6 py-3.5 flex items-center justify-between shrink-0">
          <p className="text-[11px] text-slate-400 font-semibold">
            * Dữ liệu đối soát tài chính được đồng bộ thời gian thực từ CSDL PostgreSQL của sàn ZeroMall.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition shadow-3xs cursor-pointer"
          >
            Đóng Báo Cáo
          </button>
        </div>
      </div>
    </div>
  );
};
