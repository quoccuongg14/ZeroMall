import React, { useState, useMemo } from 'react';
import type { AuditLogItem, AuditLogModule } from './audit-logs/types';
import { MODULE_CONFIG } from './audit-logs/types';
import { AuditLogDetailModal } from './audit-logs/AuditLogDetailModal';

interface AuditLogsTabProps {
  auditLogs: any[];
}

export const AuditLogsTab: React.FC<AuditLogsTabProps> = ({ auditLogs = [] }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedModule, setSelectedModule] = useState<AuditLogModule>('ALL');
  const [selectedTimeRange, setSelectedTimeRange] = useState<'ALL' | 'TODAY' | '3D' | '7D' | '30D'>('ALL');
  const [selectedLogForDetail, setSelectedLogForDetail] = useState<AuditLogItem | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Normalize logs to ensure module and clean text
  const normalizedLogs = useMemo<AuditLogItem[]>(() => {
    return auditLogs.map((log) => {
      let mod = log.module || 'SYSTEM';
      let actType = log.actionType || 'UPDATE';

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

      // 2. Time filter
      if (selectedTimeRange !== 'ALL') {
        const logDate = new Date(log.timestamp).getTime();
        const now = Date.now();
        const diffHours = (now - logDate) / (1000 * 60 * 60);

        if (selectedTimeRange === 'TODAY' && diffHours > 24) return false;
        if (selectedTimeRange === '3D' && diffHours > 72) return false;
        if (selectedTimeRange === '7D' && diffHours > 168) return false;
        if (selectedTimeRange === '30D' && diffHours > 720) return false;
      }

      // 3. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchUser = (log.user || '').toLowerCase().includes(q);
        const matchAction = (log.action || '').toLowerCase().includes(q);
        const matchTargetId = (log.targetId || '').toLowerCase().includes(q);
        const matchTargetName = (log.targetName || '').toLowerCase().includes(q);
        return matchUser || matchAction || matchTargetId || matchTargetName;
      }

      return true;
    });
  }, [normalizedLogs, selectedModule, selectedTimeRange, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(filteredLogs.length / pageSize) || 1;
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  // Export CSV
  const handleExportCSV = () => {
    if (filteredLogs.length === 0) {
      alert('Không có dữ liệu nhật ký để xuất!');
      return;
    }

    const headers = ['Thời gian', 'Người thực hiện', 'Phân hệ', 'Hành động chi tiết', 'IP'];
    const rows = filteredLogs.map((l) => [
      `"${new Date(l.timestamp).toLocaleString('vi-VN')}"`,
      `"${l.user}"`,
      `"${MODULE_CONFIG[l.module || 'SYSTEM']?.label || l.module}"`,
      `"${(l.action || '').replace(/"/g, '""')}"`,
      `"${l.ipAddress || '127.0.0.1'}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `ZeroMall_Lich_Su_Thao_Tac_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper function to format action text with bold highlights
  const renderFormattedAction = (action: string) => {
    if (!action) return null;

    // Check for quoted strings or IDs and render them with prominent bold contrast
    const parts = action.split(/(".*?"|#\w+[-\w]*)/g);
    return (
      <span className="text-[13px] text-slate-900 leading-relaxed">
        {parts.map((part, i) => {
          if (part.startsWith('"') && part.endsWith('"')) {
            return (
              <strong key={i} className="font-bold text-slate-950 px-1 py-0.5 bg-slate-100 rounded text-slate-900">
                {part}
              </strong>
            );
          }
          if (part.startsWith('#')) {
            return (
              <strong key={i} className="font-mono font-bold text-slate-950 bg-slate-100 px-1 rounded">
                {part}
              </strong>
            );
          }
          return part;
        })}
      </span>
    );
  };

  return (
    <div className="space-y-4 font-sans text-left">
      {/* Header Bar: Clean & Minimalist */}
      <div className="bg-white px-6 py-4 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
            <span>📜</span> Lịch Sử Thao Tác Hệ Thống
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Nhật ký kiểm toán ghi nhận mọi can thiệp của Quản trị viên và CSKH trên sàn theo thời gian thực.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="text-slate-500 font-medium hidden sm:inline">
            Tổng cộng: <strong className="text-slate-800">{normalizedLogs.length}</strong> thao tác
          </span>
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg border border-slate-300 transition flex items-center gap-1.5 cursor-pointer text-xs"
          >
            <span>📥</span> Xuất File CSV
          </button>
        </div>
      </div>

      {/* Filter Bar: Clean White & Slate (No eye-strain colors) */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-3">
        {/* Search & Time range */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
            <input
              type="text"
              placeholder="Tìm kiếm theo hành động, email người thực hiện, mã đơn, tên shop..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-8 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:border-slate-400 focus:outline-hidden"
            />
          </div>

          <div className="w-full sm:w-56 shrink-0">
            <select
              value={selectedTimeRange}
              onChange={(e) => {
                setSelectedTimeRange(e.target.value as any);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:bg-white focus:outline-hidden cursor-pointer"
            >
              <option value="ALL">🕒 Tất cả thời gian</option>
              <option value="TODAY">📅 Trong 24 giờ qua</option>
              <option value="3D">📅 3 ngày gần nhất</option>
              <option value="7D">📅 7 ngày gần nhất</option>
              <option value="30D">📅 30 ngày qua</option>
            </select>
          </div>
        </div>

        {/* Minimalist Neutral Tabs for Modules */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs border-t border-slate-100 pt-2.5">
          <button
            type="button"
            onClick={() => {
              setSelectedModule('ALL');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-md font-bold transition whitespace-nowrap cursor-pointer ${
              selectedModule === 'ALL'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Tất cả ({normalizedLogs.length})
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedModule('ORDERS');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-md font-bold transition whitespace-nowrap cursor-pointer ${
              selectedModule === 'ORDERS'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Đơn hàng & Khiếu nại ({normalizedLogs.filter((l) => l.module === 'ORDERS').length})
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedModule('FINANCE');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-md font-bold transition whitespace-nowrap cursor-pointer ${
              selectedModule === 'FINANCE'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Tài chính & Ví ({normalizedLogs.filter((l) => l.module === 'FINANCE').length})
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedModule('PRODUCTS');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-md font-bold transition whitespace-nowrap cursor-pointer ${
              selectedModule === 'PRODUCTS'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Sản phẩm & Vi phạm ({normalizedLogs.filter((l) => l.module === 'PRODUCTS').length})
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedModule('SHOPS');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-md font-bold transition whitespace-nowrap cursor-pointer ${
              selectedModule === 'SHOPS'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Cửa hàng ({normalizedLogs.filter((l) => l.module === 'SHOPS').length})
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedModule('USERS');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-md font-bold transition whitespace-nowrap cursor-pointer ${
              selectedModule === 'USERS'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Người dùng ({normalizedLogs.filter((l) => l.module === 'USERS').length})
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedModule('MARKETING');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-md font-bold transition whitespace-nowrap cursor-pointer ${
              selectedModule === 'MARKETING'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Banner & Khuyến mãi ({normalizedLogs.filter((l) => l.module === 'MARKETING').length})
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedModule('SECURITY');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-md font-bold transition whitespace-nowrap cursor-pointer ${
              selectedModule === 'SECURITY'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Bảo mật & Phân quyền ({normalizedLogs.filter((l) => l.module === 'SECURITY').length})
          </button>
        </div>
      </div>

      {/* High-Contrast Focused Audit Table */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/80 text-slate-500 uppercase font-bold text-[11px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 w-36">Thời Gian</th>
                <th className="py-3 px-4 w-48">Người Thực Hiện</th>
                <th className="py-3 px-4">Hành Động Thao Tác (Chi Tiết Toàn Văn)</th>
                <th className="py-3 px-4 w-28 text-center">Địa Chỉ IP</th>
                <th className="py-3 px-4 w-20 text-right">Chi Tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedLogs.length > 0 ? (
                paginatedLogs.map((log) => {
                  const modInfo = MODULE_CONFIG[log.module || 'SYSTEM'] || MODULE_CONFIG.SYSTEM;
                  const isCs = (log.user || '').toLowerCase().includes('cskh');

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/60 transition group">
                      {/* 1. Time */}
                      <td className="py-3 px-4 font-mono text-xs text-slate-500 whitespace-nowrap align-top pt-3.5">
                        <div className="font-bold text-slate-700">
                          {new Date(log.timestamp).toLocaleTimeString('vi-VN')}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {new Date(log.timestamp).toLocaleDateString('vi-VN')}
                        </div>
                      </td>

                      {/* 2. Actor */}
                      <td className="py-3 px-4 whitespace-nowrap align-top pt-3.5">
                        <div className="font-bold text-slate-800 text-xs truncate max-w-[170px]" title={log.user}>
                          {log.user}
                        </div>
                        <div className="text-[10px] font-semibold text-slate-400 mt-0.5">
                          {isCs ? '🎧 CSKH Sàn' : '🛡️ Quản trị viên'}
                        </div>
                      </td>

                      {/* 3. Action Description: Clear, Prominent, High-Contrast */}
                      <td className="py-3 px-4 align-top">
                        <div className="space-y-1">
                          {/* Neutral Tag for Module */}
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/80">
                              <span>{modInfo.icon}</span>
                              <span>{modInfo.label}</span>
                            </span>
                          </div>

                          {/* Action text prominently displayed */}
                          <div className="pt-0.5">
                            {renderFormattedAction(log.action)}
                          </div>
                        </div>
                      </td>

                      {/* 4. IP Address */}
                      <td className="py-3 px-4 text-center font-mono text-[11px] text-slate-400 whitespace-nowrap align-top pt-3.5">
                        {log.ipAddress || '127.0.0.1'}
                      </td>

                      {/* 5. Detail Button */}
                      <td className="py-3 px-4 text-right whitespace-nowrap align-top pt-3.5">
                        <button
                          type="button"
                          onClick={() => setSelectedLogForDetail(log)}
                          className="text-xs font-bold text-slate-600 hover:text-slate-900 hover:underline cursor-pointer"
                        >
                          Xem ➔
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 text-xs">
                    <div className="text-2xl mb-1">📜</div>
                    <div className="font-bold text-slate-600">Không tìm thấy thao tác nào phù hợp</div>
                    <div className="text-slate-400 mt-0.5">Thử chọn khoảng thời gian khác hoặc kiểm tra từ khóa tìm kiếm</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="text-slate-500 font-medium">
            Hiển thị <strong className="text-slate-800">{paginatedLogs.length}</strong> trên{' '}
            <strong className="text-slate-800">{filteredLogs.length}</strong> nhật ký
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-bold cursor-pointer text-xs"
              >
                ‹ Trước
              </button>
              <span className="px-2.5 py-1 font-bold text-slate-700 bg-white border border-slate-200 rounded text-xs">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-bold cursor-pointer text-xs"
              >
                Sau ›
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
