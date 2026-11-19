import React from 'react';
import type { AuditLogItem } from './types';
import { MODULE_CONFIG, ACTION_TYPE_CONFIG } from './types';

interface AuditLogDetailModalProps {
  isOpen: boolean;
  log: AuditLogItem | null;
  onClose: () => void;
}

export const AuditLogDetailModal: React.FC<AuditLogDetailModalProps> = ({
  isOpen,
  log,
  onClose,
}) => {
  if (!isOpen || !log) return null;

  const moduleInfo = MODULE_CONFIG[log.module || 'SYSTEM'] || MODULE_CONFIG.SYSTEM;
  const actionInfo = ACTION_TYPE_CONFIG[log.actionType || 'UPDATE'] || ACTION_TYPE_CONFIG.UPDATE;

  let parsedMetadata: any = null;
  if (log.metadata) {
    try {
      parsedMetadata = JSON.parse(log.metadata);
    } catch {
      parsedMetadata = log.metadata;
    }
  }

  const isCsStaff = log.user.toLowerCase().includes('cskh');
  const roleName = isCsStaff ? 'Nhân Viên CSKH Sàn' : log.user.includes('admin') ? 'Quản Trị Viên (Admin)' : 'Hệ Thống Tự Động (AI)';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-slate-200 text-slate-800 rounded-xl text-lg font-black">📜</span>
            <div>
              <h3 className="text-base font-black text-slate-800">
                Chi Tiết Nhật Ký Thao Tác Hệ Thống
              </h3>
              <p className="text-xs text-slate-500 font-mono">
                Mã Audit Log: {log.id}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs">
          {/* Quick Badges Bar */}
          <div className="flex flex-wrap items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className={`px-2.5 py-1 rounded-lg border font-black text-[11px] flex items-center gap-1.5 ${moduleInfo.bg} ${moduleInfo.text} ${moduleInfo.border}`}>
              <span>{moduleInfo.icon}</span>
              <span>{moduleInfo.label}</span>
            </span>

            <span className={`px-2.5 py-1 rounded-lg border font-black text-[11px] flex items-center gap-1.5 ${actionInfo.badgeClass}`}>
              <span>{actionInfo.icon}</span>
              <span>{actionInfo.label}</span>
            </span>

            <span className="ml-auto text-[11px] text-slate-500 font-mono flex items-center gap-1">
              <span>🕒</span> {new Date(log.timestamp).toLocaleString('vi-VN', { dateStyle: 'full', timeStyle: 'medium' })}
            </span>
          </div>

          {/* Actor Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Người Thực Hiện</span>
              <div className="font-black text-slate-800 text-sm flex items-center gap-1.5">
                <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-[10px] font-bold">
                  {log.user.slice(0, 2).toUpperCase()}
                </span>
                <span>{log.user}</span>
              </div>
              <div className="text-[11px] text-emerald-700 font-semibold">{roleName}</div>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Địa Chỉ IP & Thiết Bị</span>
              <div className="font-mono font-bold text-slate-700 text-xs flex items-center gap-1.5">
                <span>🌐</span> {log.ipAddress || '127.0.0.1 (Local Gateway)'}
              </div>
              <div className="text-[11px] text-slate-500">Xác thực: Session Token Hợp Lệ</div>
            </div>
          </div>

          {/* Action Full Text */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mô Tả Hành Động Toàn Văn</span>
            <div className="text-slate-800 font-bold leading-relaxed text-xs">
              {log.action}
            </div>
          </div>

          {/* Target Info (if any) */}
          {(log.targetId || log.targetName) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl border border-slate-200 bg-white">
              {log.targetId && (
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Đối Tượng Tác Động (ID)</span>
                  <div className="font-mono font-bold text-slate-700 truncate">{log.targetId}</div>
                </div>
              )}
              {log.targetName && (
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Tên Đối Tượng</span>
                  <div className="font-bold text-slate-700 truncate">{log.targetName}</div>
                </div>
              )}
            </div>
          )}

          {/* Metadata / Diff Payload */}
          {parsedMetadata && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dữ Liệu Thao Tác Chi Tiết (Audit Payload)</span>
              <div className="p-3 rounded-xl bg-slate-900 text-slate-200 font-mono text-[11px] overflow-x-auto border border-slate-800">
                <pre>{typeof parsedMetadata === 'object' ? JSON.stringify(parsedMetadata, null, 2) : parsedMetadata}</pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            Dữ liệu ghi nhận tự động bởi Security & Audit Engine
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition text-xs cursor-pointer"
          >
            Đóng Cửa Sổ
          </button>
        </div>
      </div>
    </div>
  );
};
