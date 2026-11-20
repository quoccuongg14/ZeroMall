import React, { useState, useEffect } from 'react'
import { API_BASE_URL } from '../../config/api.config'
import { LockUserModal } from '../admin/LockUserModal'

interface CsUsersTabProps {
  triggerAuditLog: (action: string) => Promise<void>
}

export const CsUsersTab: React.FC<CsUsersTabProps> = ({ triggerAuditLog }) => {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLockUser, setSelectedLockUser] = useState<any | null>(null)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState<number>(Date.now())
  const [searchQuery, setSearchQuery] = useState<string>('')
  
  // Mặc định: Tập trung hiển thị Khách Hàng (Buyers) để CSKH xử lý bom hàng / gian lận
  const [roleFilter, setRoleFilter] = useState<string>('BUYER')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')

  // Cập nhật bộ đếm thời gian thực mỗi giây để đếm ngược hạn khóa chính xác
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Chỉ lấy người dùng thuộc phạm vi sàn thương mại điện tử (scope=marketplace)
  const fetchUsers = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/auth/users?scope=marketplace`)
      if (res.ok) {
        const data = await res.json()
        setUsers(data)
      }
    } catch (err) {
      console.error('Error fetching marketplace users for CSKH:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  // Hàm tính toán và định dạng thời gian khóa tài khoản còn lại
  const getBanCountdown = (blockedUntil?: string | null) => {
    if (!blockedUntil) {
      return {
        text: 'Khóa vĩnh viễn',
        type: 'permanent',
        icon: '🔒',
        endDate: null,
      }
    }

    const target = new Date(blockedUntil).getTime()
    const diff = target - currentTime

    if (diff <= 0) {
      return {
        text: 'Đã hết hạn khóa (Có thể mở)',
        type: 'expired',
        icon: '⚠️',
        endDate: new Date(blockedUntil).toLocaleString('vi-VN', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
      }
    }

    const totalSeconds = Math.floor(diff / 1000)
    const days = Math.floor(totalSeconds / (24 * 3600))
    const hours = Math.floor((totalSeconds % (24 * 3600)) / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    let timeString = ''
    if (days > 0) {
      timeString = `${days} ngày ${hours}h ${minutes}p`
    } else if (hours > 0) {
      timeString = `${hours}h ${minutes}p ${seconds}s`
    } else {
      timeString = `${minutes}p ${seconds}s`
    }

    return {
      text: `Còn lại: ${timeString}`,
      type: 'countdown',
      icon: '⏳',
      endDate: new Date(blockedUntil).toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    }
  }

  // Mở khóa trực tiếp cho người dùng
  const handleUnblockUser = async (u: any) => {
    if (!window.confirm(`Xác nhận mở khóa hoạt động lại cho tài khoản "${u.email}" (ID: ${u.id})?`)) {
      return
    }

    setActionLoadingId(u.id)
    try {
      const res = await fetch(`${API_BASE_URL}/auth/users/${u.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ACTIVE', blockedUntil: null, blockReason: null }),
      })

      if (res.ok) {
        await triggerAuditLog(`[CSKH FRAUD-DESK] Mở khóa tài khoản người dùng "${u.email}" (Mã: ${u.id})`)
        alert(`✅ Đã mở khóa thành công cho tài khoản "${u.email}"!`)
        fetchUsers()
      } else {
        const err = await res.json().catch(() => ({}))
        alert(err.message || 'Lỗi khi mở khóa tài khoản')
      }
    } catch (err: any) {
      alert(err.message || 'Lỗi kết nối khi mở khóa tài khoản')
    } finally {
      setActionLoadingId(null)
    }
  }

  // Bộ lọc bảo vệ kép (Safeguard): Tuyệt đối không hiển thị tài khoản Logistics hay Admin nội bộ
  const marketplaceUsers = users.filter((u) => {
    return u.role === 'BUYER' || u.role === 'SHOP_OWNER' || u.role === 'SELLER'
  })

  // Đếm theo từng vai trò sàn
  const countBuyers = marketplaceUsers.filter((u) => u.role === 'BUYER').length
  const countSellers = marketplaceUsers.filter((u) => u.role === 'SHOP_OWNER' || u.role === 'SELLER').length
  const countAll = marketplaceUsers.length
  const countBlocked = marketplaceUsers.filter((u) => u.status === 'BLOCKED').length

  // Lọc danh sách theo từ khóa tìm kiếm, vai trò và trạng thái
  const filteredUsers = marketplaceUsers.filter((u) => {
    const q = searchQuery.toLowerCase().trim()
    const matchQuery =
      !q ||
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.phoneNumber?.includes(q) ||
      u.id?.toLowerCase().includes(q)

    let matchRole = true
    if (roleFilter === 'BUYER') {
      matchRole = u.role === 'BUYER'
    } else if (roleFilter === 'SELLER') {
      matchRole = u.role === 'SHOP_OWNER' || u.role === 'SELLER'
    }

    const matchStatus = statusFilter === 'ALL' || u.status === statusFilter

    return matchQuery && matchRole && matchStatus
  })

  return (
    <div className="space-y-5 text-left">
      {/* 1. Statistics Cards (Chỉ thống kê người dùng thuộc Sàn ZeroMall) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div
          onClick={() => { setRoleFilter('BUYER'); setStatusFilter('ALL') }}
          className={`bg-white border rounded-xl p-4 shadow-2xs cursor-pointer transition ${
            roleFilter === 'BUYER' && statusFilter === 'ALL' ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200/70 hover:border-emerald-400'
          }`}
        >
          <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider flex items-center gap-1">
            <span>👤</span> Khách Hàng (Buyers)
          </p>
          <p className="text-2xl font-black text-emerald-600 mt-1">{countBuyers}</p>
          <p className="text-[9px] text-emerald-700/70 font-semibold mt-1">Người mua hàng trên sàn</p>
        </div>

        <div
          onClick={() => { setRoleFilter('SELLER'); setStatusFilter('ALL') }}
          className={`bg-white border rounded-xl p-4 shadow-2xs cursor-pointer transition ${
            roleFilter === 'SELLER' && statusFilter === 'ALL' ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-200/70 hover:border-indigo-400'
          }`}
        >
          <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider flex items-center gap-1">
            <span>🏪</span> Chủ Gian Hàng (Sellers)
          </p>
          <p className="text-2xl font-black text-indigo-600 mt-1">{countSellers}</p>
          <p className="text-[9px] text-indigo-700/70 font-semibold mt-1">Chủ shop kinh doanh</p>
        </div>

        <div
          onClick={() => { setStatusFilter('BLOCKED'); setRoleFilter('ALL') }}
          className={`bg-white border rounded-xl p-4 shadow-2xs cursor-pointer transition ${
            statusFilter === 'BLOCKED' ? 'border-rose-500 ring-2 ring-rose-500/20' : 'border-slate-200/70 hover:border-rose-400'
          }`}
        >
          <p className="text-[10px] text-rose-600 font-bold uppercase tracking-wider flex items-center gap-1">
            <span>🔒</span> Tài Khoản Đang Bị Khóa
          </p>
          <p className="text-2xl font-black text-rose-600 mt-1">{countBlocked}</p>
          <p className="text-[9px] text-rose-700/70 font-semibold mt-1">Gian lận / Bom hàng / Kỷ luật</p>
        </div>

        <div
          onClick={() => { setStatusFilter('ALL'); setRoleFilter('ALL') }}
          className={`bg-white border rounded-xl p-4 shadow-2xs cursor-pointer transition ${
            roleFilter === 'ALL' && statusFilter === 'ALL' ? 'border-slate-800 ring-2 ring-slate-800/20' : 'border-slate-200/70 hover:border-slate-400'
          }`}
        >
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Tổng Người Dùng Sàn</p>
          <p className="text-2xl font-black text-slate-800 mt-1">{countAll}</p>
          <p className="text-[9px] text-slate-400 font-semibold mt-1">Người mua & Người bán</p>
        </div>
      </div>

      {/* 2. Filter & Search Controls */}
      <div className="bg-white border border-slate-200/70 rounded-xl p-4 shadow-2xs flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex flex-wrap gap-1.5 w-full sm:w-auto">
          {[
            { id: 'BUYER', label: `👤 Người mua (${countBuyers})`, type: 'role' },
            { id: 'SELLER', label: `🏪 Chủ gian hàng (${countSellers})`, type: 'role' },
            { id: 'BLOCKED', label: `🔒 Đang bị khóa (${countBlocked})`, type: 'status' },
            { id: 'ALL', label: `🌐 Toàn bộ người dùng sàn (${countAll})`, type: 'all' },
          ].map((item) => {
            const isActive =
              item.type === 'role'
                ? roleFilter === item.id && statusFilter === 'ALL'
                : item.type === 'status'
                ? statusFilter === item.id
                : roleFilter === 'ALL' && statusFilter === 'ALL'

            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.type === 'role') {
                    setRoleFilter(item.id)
                    setStatusFilter('ALL')
                  } else if (item.type === 'status') {
                    setStatusFilter(item.id)
                    setRoleFilter('ALL')
                  } else {
                    setRoleFilter('ALL')
                    setStatusFilter('ALL')
                  }
                }}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer border ${
                  isActive
                    ? 'bg-slate-900 text-white border-slate-900 shadow-3xs'
                    : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'
                }`}
              >
                {item.label}
              </button>
            )
          })}
        </div>

        <div className="w-full sm:w-80 relative">
          <input
            type="text"
            placeholder="Tìm theo tên, email, SĐT, ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-hidden focus:border-slate-500 focus:bg-white transition"
          />
          <span className="absolute left-3 top-2.5 text-slate-400 text-xs">🔍</span>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* 3. Table of Marketplace Users */}
      <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-2xs">
        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400 space-y-2">
            <div className="w-6 h-6 border-2 border-slate-700 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="font-bold">Đang tải danh sách người dùng sàn...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-16 text-center text-slate-400 space-y-2">
            <span className="text-3xl">📭</span>
            <p className="text-sm font-extrabold text-slate-500">Không tìm thấy tài khoản người dùng sàn phù hợp</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-slate-700">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-3.5 px-4">Tài Khoản & Mã ID</th>
                  <th className="py-3.5 px-3">Email & SĐT</th>
                  <th className="py-3.5 px-3 text-center">Vai Trò Sàn</th>
                  <th className="py-3.5 px-3 text-center">Trạng Thái & Hạn Khóa</th>
                  <th className="py-3.5 px-4 text-center">Nghiệp Vụ CSKH</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((u) => {
                  const isBlocked = u.status === 'BLOCKED'
                  const countdown = isBlocked ? getBanCountdown(u.blockedUntil) : null
                  const isSeller = u.role === 'SHOP_OWNER' || u.role === 'SELLER'

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/50 transition">
                      {/* Cột 1: Thông tin User */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full border font-black text-xs flex items-center justify-center shrink-0 ${
                            isSeller ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          }`}>
                            {(u.name || u.email || 'U')[0].toUpperCase()}
                          </div>
                          <div className="space-y-0.5 min-w-0">
                            <p className="font-bold text-slate-900 truncate">{u.name || 'Người dùng chưa đặt tên'}</p>
                            <p className="text-[10px] text-slate-400 font-mono">ID: {u.id}</p>
                          </div>
                        </div>
                      </td>

                      {/* Cột 2: Email & SĐT */}
                      <td className="py-3.5 px-3">
                        <div className="space-y-0.5">
                          <p className="font-semibold text-slate-800">{u.email}</p>
                          <p className="text-[11px] text-slate-500">{u.phoneNumber || 'Chưa có SĐT'}</p>
                        </div>
                      </td>

                      {/* Cột 3: Vai trò sàn */}
                      <td className="py-3.5 px-3 text-center">
                        <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase border ${
                          isSeller 
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200' 
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          {isSeller ? '🏪 Chủ Gian Hàng' : '👤 Khách Hàng (Buyer)'}
                        </span>
                      </td>

                      {/* Cột 4: Trạng thái & Countdown */}
                      <td className="py-3.5 px-3 text-center">
                        <div className="inline-flex flex-col items-center gap-1">
                          {isBlocked ? (
                            <span className="px-2 py-0.5 bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-black rounded-md flex items-center gap-1">
                              <span>{countdown?.icon}</span>
                              <span>{countdown?.text}</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-black rounded-md">
                              ✅ Hoạt Động
                            </span>
                          )}

                          {isBlocked && u.blockReason && (
                            <p className="text-[10px] text-rose-600 max-w-[180px] truncate font-medium" title={u.blockReason}>
                              {u.blockReason}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Cột 5: Chế tài & Thao tác CSKH */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {isBlocked ? (
                            <button
                              disabled={actionLoadingId === u.id}
                              onClick={() => handleUnblockUser(u)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition shadow-3xs cursor-pointer disabled:opacity-50 flex items-center gap-1"
                            >
                              <span>🔓</span> Mở Khóa
                            </button>
                          ) : (
                            <button
                              onClick={() => setSelectedLockUser(u)}
                              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-3xs"
                              title="Tạm khóa tài khoản do gian lận / bom hàng"
                            >
                              <span>🔒</span> Khóa Tài Khoản
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. MODAL KHÓA NGƯỜI DÙNG */}
      <LockUserModal
        isOpen={!!selectedLockUser}
        user={selectedLockUser}
        onClose={() => setSelectedLockUser(null)}
        onSuccess={() => {
          setSelectedLockUser(null)
          fetchUsers()
        }}
        triggerAuditLog={triggerAuditLog}
      />
    </div>
  )
}
