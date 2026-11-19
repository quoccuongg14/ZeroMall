import React, { useState, useMemo } from 'react';
import type { AuditLogItem, AuditLogModule, AuditLogActionType } from './audit-logs/types';
import { MODULE_CONFIG, ACTION_TYPE_CONFIG } from './audit-logs/types';
import { AuditLogDetailModal } from './audit-logs/AuditLogDetailModal';

interface AuditLogsTabProps {
  auditLogs: any[];
}

export const AuditLogsTab: React.FC<AuditLogsTabProps> = ({ auditLogs = [] }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedModule, setSelectedModule] = useState<AuditLogModule>('ALL');
  const [selectedActionType, setSelectedActionType] = useState<AuditLogActionType>('ALL');
  const [selectedTimeRange, setSelectedTimeRange] = useState<'ALL' | 'TODAY' | '3D' | '7D' | '30D'>('ALL');
  const [selectedLogForDetail, setSelectedLogForDetail] = useState<AuditLogItem | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Normalize logs to ensure module and actionType exist
  const normalizedLogs = useMemo<AuditLogItem[]>(() => {
    return auditLogs.map((log) => {
      let mod = log.module || 'SYSTEM';
      let actType = log.actionType || 'UPDATE';

      // Deduce fallback if empty
      if (!log.module) {
        const a = (log.action || '').toLowerCase();
        if (a.includes('đơn hàng') || a.includes('giao hàng') || a.includes('bưu cục') || a.includes('tài xế')) mod = 'ORDERS';
        else if (a.includes('rút tiền') || a.includes('chiết khấu') || a.includes('ví') || a.includes('hoàn tiền')) mod = 'FINANCE';
        else if (a.includes('sản phẩm') || a.includes('ngành hàng') || a.includes('vi phạm')) mod = 'PRODUCTS';
        else if (a.includes('cửa hàng') || a.includes('shop')) mod = 'SHOPS';
        else if (a.includes('tài khoản') || a.includes('người dùng') || a.includes('user')) mod = 'USERS';
        else if (a.includes('banner') || a.includes('voucher') || a.includes('flash sale')) mod = 'MARKETING';
        else if (a.includes('cskh') || a.includes('bảo mật') || a.includes('xuất')) mod = 'SECURITY';
      }

      if (!log.actionType) {
        const a = (log.action || '').toLowerCase();
        if (a.includes('tạo') || a.includes('thêm')) actType = 'CREATE';
        else if (a.includes('phê duyệt') || a.includes('kích hoạt') || a.includes('chấp thuận')) actType = 'APPROVE';
        else if (a.includes('mở khóa')) actType = 'UNLOCK';
        else if (a.includes('khóa') || a.includes('tạm ngưng')) actType = 'LOCK';
        else if (a.includes('xóa')) actType = 'DELETE';
        else if (a.includes('từ chối')) actType = 'REJECT';
        else if (a.includes('xuất')) actType = 'SECURITY';
      }

      return {
        ...log,
        module: mod,
        actionType: actType,
      };
    });
  }, [auditLogs]);

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    return normalizedLogs.filter((log) => {
      // 1. Module filter
      if (selectedModule !== 'ALL' && log.module !== selectedModule) {
        return false;
      }

      // 2. Action Type filter
      if (selectedActionType !== 'ALL' && log.actionType !== selectedActionType) {
        return false;
      }

      // 3. Time filter
      if (selectedTimeRange !== 'ALL') {
        const logDate = new Date(log.timestamp).getTime();
        const now = Date.now();
        const diffHours = (now - logDate) / (1000 * 60 * 60);

        if (selectedTimeRange === 'TODAY' && diffHours > 24) return false;
        if (selectedTimeRange === '3D' && diffHours > 72) return false;
        if (selectedTimeRange === '7D' && diffHours > 168) return false;
        if (selectedTimeRange === '30D' && diffHours > 720) return false;
      }

      // 4. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchUser = (log.user || '').toLowerCase().includes(q);
        const matchAction = (log.action || '').toLowerCase().includes(q);
        const matchTargetId = (log.targetId || '').toLowerCase().includes(q);
        const matchTargetName = (log.targetName || '').toLowerCase().includes(q);
        const matchIp = (log.ipAddress || '').toLowerCase().includes(q);
        return matchUser || matchAction || matchTargetId || matchTargetName || matchIp;
      }

      return true;
    });
  }, [normalizedLogs, selectedModule, selectedActionType, selectedTimeRange, searchQuery]);

  // Pagination slice
  const totalPages = Math.ceil(filteredLogs.length / pageSize) || 1;
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  // Summary Metrics
  const stats = useMemo(() => {
    const total = normalizedLogs.length;
    const ordersCount = normalizedLogs.filter((l) => l.module === 'ORDERS').length;
    const financeCount = normalizedLogs.filter((l) => l.module === 'FINANCE').length;
    const highRiskCount = normalizedLogs.filter((l) => ['LOCK', 'DELETE', 'REJECT', 'SECURITY'].includes(l.actionType || '')).length;
    return { total, ordersCount, financeCount, highRiskCount };
  }, [normalizedLogs]);

  // Export CSV
  const handleExportCSV = () => {
    if (filteredLogs.length === 0) {
      alert('Không có dữ liệu nhật ký để xuất!');
      return;
    }

    const headers = ['Thời gian', 'Người thực hiện', 'Phân hệ', 'Loại thao tác', 'Hành động chi tiết', 'IP Address'];
    const rows = filteredLogs.map((l) => [
      `"${new Date(l.timestamp).toLocaleString('vi-VN')}"`,
      `"${l.user}"`,
      `"${MODULE_CONFIG[l.module || 'SYSTEM']?.label || l.module}"`,
      `"${ACTION_TYPE_CONFIG[l.actionType || 'UPDATE']?.label || l.actionType}"`,
      `"${(l.action || '').replace(/"/g, '""')}"`,
      `"${l.ipAddress || '127.0.0.1'}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `ZeroMall_Audit_Logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl text-xl font-black">📜</span>
          <div>
            <h2 className="text-lg font-black text-slate-800">
              Nhật Ký Lịch Sử Thao Tác Hệ Thống (Audit Trail)
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Giám sát toàn diện mọi can thiệp của Quản trị viên, CSKH và Tự động hóa AI trên sàn theo chuẩn Shopee Operations.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-3xs cursor-pointer hover:border-emerald-500"
          >
            <span>📥</span> Xuất File Báo Cáo (CSV)
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
            <span>Tổng số thao tác</span>
            <span>📊</span>
          </div>
          <div className="text-2xl font-black text-slate-800">{stats.total}</div>
          <div className="text-[11px] text-emerald-700 font-semibold">Ghi nhận liên tục 24/7</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-blue-500 text-xs font-bold">
            <span>Đơn hàng & Tranh chấp</span>
            <span>🛒</span>
          </div>
          <div className="text-2xl font-black text-blue-700">{stats.ordersCount}</div>
          <div className="text-[11px] text-slate-500">Hoàn tiền, hủy đơn, đổi tuyến</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-emerald-500 text-xs font-bold">
            <span>Tài chính & Rút tiền</span>
            <span>💰</span>
          </div>
          <div className="text-2xl font-black text-emerald-700">{stats.financeCount}</div>
          <div className="text-[11px] text-slate-500">Duyệt lệnh rút tiền & chiết khấu</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-rose-500 text-xs font-bold">
            <span>Thao tác nhạy cảm</span>
            <span>⚠️</span>
          </div>
          <div className="text-2xl font-black text-rose-600">{stats.highRiskCount}</div>
          <div className="text-[11px] text-slate-500">Khóa shop, xóa tài khoản, phạt SP</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        {/* Row 1: Search & Dropdowns */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Search box */}
          <div className="md:col-span-6 relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
            <input
              type="text"
              placeholder="Tìm theo email người thực hiện, mã đơn, tên shop, từ khóa hành động..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 outline-hidden font-medium"
            />
          </div>

          {/* Action Type filter */}
          <div className="md:col-span-3">
            <select
              value={selectedActionType}
              onChange={(e) => {
                setSelectedActionType(e.target.value as any);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-hidden cursor-pointer"
            >
              <option value="ALL">-- Tất cả loại hành động --</option>
              <option value="CREATE">➕ Tạo mới (Create)</option>
              <option value="UPDATE">✏️ Cập nhật (Update)</option>
              <option value="APPROVE">✅ Phê duyệt (Approve)</option>
              <option value="UNLOCK">🔓 Mở khóa (Unlock)</option>
              <option value="LOCK">🔒 Khóa / Phạt (Lock)</option>
              <option value="REJECT">⛔ Từ chối (Reject)</option>
              <option value="DELETE">🗑️ Xóa bỏ (Delete)</option>
              <option value="SECURITY">⚠️ An ninh & Xuất file</option>
            </select>
          </div>

          {/* Time range filter */}
          <div className="md:col-span-3">
            <select
              value={selectedTimeRange}
              onChange={(e) => {
                setSelectedTimeRange(e.target.value as any);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-hidden cursor-pointer"
            >
              <option value="ALL">🕒 Tất cả thời gian</option>
              <option value="TODAY">📅 Trong 24 giờ qua</option>
              <option value="3D">📅 3 ngày gần nhất</option>
              <option value="7D">📅 7 ngày gần nhất</option>
              <option value="30D">📅 30 ngày qua</option>
            </select>
          </div>
        </div>

        {/* Row 2: Module Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-bold scrollbar-none">
          <span className="text-[11px] text-slate-400 font-bold uppercase shrink-0 mr-1">Phân hệ:</span>
          <button
            type="button"
            onClick={() => {
              setSelectedModule('ALL');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg border transition whitespace-nowrap cursor-pointer ${
              selectedModule === 'ALL'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-3xs'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            Tất Cả ({normalizedLogs.length})
          </button>

          {Object.entries(MODULE_CONFIG).map(([modKey, modInfo]) => {
            const count = normalizedLogs.filter((l) => l.module === modKey).length;
            const isSelected = selectedModule === modKey;
            return (
              <button
                key={modKey}
                type="button"
                onClick={() => {
                  setSelectedModule(modKey as AuditLogModule);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg border transition whitespace-nowrap flex items-center gap-1 cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-3xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span>{modInfo.icon}</span>
                <span>{modInfo.label}</span>
                <span className={`text-[10px] ml-0.5 px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-white/30 text-white' : 'bg-slate-200 text-slate-700'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4 w-40">Thời Gian</th>
                <th className="py-3.5 px-4 w-56">Người Thực Hiện</th>
                <th className="py-3.5 px-4 w-44">Phân Hệ (Module)</th>
                <th className="py-3.5 px-4 w-32">Loại Thao Tác</th>
                <th className="py-3.5 px-4">Hành Động Chi Tiết</th>
                <th className="py-3.5 px-4 w-28 text-center">Địa Chỉ IP</th>
                <th className="py-3.5 px-4 w-24 text-right">Chi Tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedLogs.length > 0 ? (
                paginatedLogs.map((log) => {
                  const modInfo = MODULE_CONFIG[log.module || 'SYSTEM'] || MODULE_CONFIG.SYSTEM;
                  const actInfo = ACTION_TYPE_CONFIG[log.actionType || 'UPDATE'] || ACTION_TYPE_CONFIG.UPDATE;
                  const isCs = log.user.toLowerCase().includes('cskh');

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition">
                      {/* Time */}
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                        <div className="font-bold text-slate-700">
                          {new Date(log.timestamp).toLocaleTimeString('vi-VN')}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(log.timestamp).toLocaleDateString('vi-VN')}
                        </div>
                      </td>

                      {/* Actor */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${
                            isCs ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {log.user.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="overflow-hidden">
                            <div className="font-bold text-slate-800 truncate text-[11px] max-w-[170px]" title={log.user}>
                              {log.user}
                            </div>
                            <span className={`inline-block text-[9px] font-extrabold px-1.5 py-0.2 rounded-sm ${
                              isCs ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}>
                              {isCs ? '🎧 CSKH SÀN' : '🛡️ ADMIN SÀN'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Module */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md border text-[11px] font-bold ${modInfo.bg} ${modInfo.text} ${modInfo.border}`}>
                          <span>{modInfo.icon}</span>
                          <span>{modInfo.label}</span>
                        </span>
                      </td>

                      {/* Action Type */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md border text-[10px] font-black uppercase ${actInfo.badgeClass}`}>
                          <span>{actInfo.icon}</span>
                          <span>{actInfo.label}</span>
                        </span>
                      </td>

                      {/* Action Description */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-700 line-clamp-2 text-xs leading-relaxed">
                          {log.action}
                        </div>
                        {log.targetId && (
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            Mã: {log.targetId}
                          </div>
                        )}
                      </td>

                      {/* IP */}
                      <td className="py-3.5 px-4 text-center font-mono text-[10px] text-slate-500 whitespace-nowrap">
                        {log.ipAddress || '127.0.0.1'}
                      </td>

                      {/* Actions button */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedLogForDetail(log)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-[11px] transition cursor-pointer"
                        >
                          Chi tiết 🔍
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="text-3xl mb-2">📜</div>
                    <div className="font-bold text-slate-600 text-sm">Không tìm thấy nhật ký thao tác nào</div>
                    <div className="text-xs text-slate-400 mt-1">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm của bạn</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="text-slate-500 font-medium">
            Hiển thị <strong className="text-slate-800">{paginatedLogs.length}</strong> trên{' '}
            <strong className="text-slate-800">{filteredLogs.length}</strong> nhật ký thao tác
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-bold cursor-pointer"
              >
                ‹ Trang Trước
              </button>
              <span className="px-3 py-1.5 font-bold text-slate-700 bg-white border border-slate-200 rounded-lg">
                Trang {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-bold cursor-pointer"
              >
                Trang Sau ›
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      <AuditLogDetailModal
        isOpen={!!selectedLogForDetail}
        log={selectedLogForDetail}
        onClose={() => setSelectedLogForDetail(null)}
      />
    </div>
  );
};
