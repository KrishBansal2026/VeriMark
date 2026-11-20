'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  Search,
  Shield,
  KeyRound,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
  UserCheck,
  UserX,
  RefreshCw,
  Copy,
  Check,
  Filter,
  Eye,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { SafeUserRecord, UserRole } from '@/lib/types';
import Header from '@/components/Header';

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<SafeUserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modal States
  const [resetModalUser, setResetModalUser] = useState<SafeUserRecord | null>(null);
  const [customPassword, setCustomPassword] = useState('');
  const [useAutoGenerate, setUseAutoGenerate] = useState(true);
  const [forceChangeNextLogin, setForceChangeNextLogin] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [resetSuccessData, setResetSuccessData] = useState<{
    temporaryPassword: string;
    userName: string;
    userEmail: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Status Toggle Modal
  const [toggleStatusUser, setToggleStatusUser] = useState<SafeUserRecord | null>(null);
  const [toggling, setToggling] = useState(false);

  // Feedback Notification
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/admin/users');
      const data = await res.json();

      if (!res.ok || !data.success) {
        if (res.status === 401) {
          router.replace('/login');
          return;
        }
        if (res.status === 403) {
          router.replace('/access-denied?reason=admin_required');
          return;
        }
        throw new Error(data.error || 'Failed to fetch user directory');
      }

      setUsers(data.users || []);
    } catch (err: any) {
      setError(err.message || 'Error loading users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification(null);
    }, 4500);
  };

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.studentRegNo && u.studentRegNo.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;

      let matchesStatus = true;
      if (statusFilter === 'ACTIVE') matchesStatus = u.isActive;
      if (statusFilter === 'INACTIVE') matchesStatus = !u.isActive;
      if (statusFilter === 'MUST_CHANGE') matchesStatus = u.mustChangePassword;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchTerm, roleFilter, statusFilter]);

  // KPI Metrics
  const metrics = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.isActive).length;
    const students = users.filter((u) => u.role === 'STUDENT').length;
    const pendingReset = users.filter((u) => u.mustChangePassword).length;
    return { total, active, students, pendingReset };
  }, [users]);

  // Execute Password Reset
  const handleExecuteReset = async () => {
    if (!resetModalUser) return;
    setResetting(true);
    setError(null);

    try {
      const payload: any = {
        forceChangeOnNextLogin: forceChangeNextLogin,
      };

      if (useAutoGenerate) {
        payload.generateTemporary = true;
      } else {
        payload.newPassword = customPassword;
      }

      const res = await fetch(`/api/admin/users/${resetModalUser.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to reset password');
      }

      setResetSuccessData({
        temporaryPassword: data.temporaryPassword,
        userName: resetModalUser.name,
        userEmail: resetModalUser.email,
      });

      showNotification('success', `Password successfully reset for ${resetModalUser.name}.`);
      fetchUsers();
    } catch (err: any) {
      showNotification('error', err.message || 'Password reset error');
    } finally {
      setResetting(false);
    }
  };

  // Execute Account Activation / Deactivation
  const handleToggleStatus = async () => {
    if (!toggleStatusUser) return;
    setToggling(true);

    try {
      const newStatus = !toggleStatusUser.isActive;
      const res = await fetch(`/api/admin/users/${toggleStatusUser.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: newStatus }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Status update failed');
      }

      showNotification('success', data.message);
      setToggleStatusUser(null);
      fetchUsers();
    } catch (err: any) {
      showNotification('error', err.message || 'Status toggle failed');
    } finally {
      setToggling(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-purple-500/15 text-purple-300 border-purple-500/30';
      case 'EXAM_CONTROLLER':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      case 'ACADEMIC_DEAN':
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
      case 'AUDITOR':
        return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30';
      case 'STUDENT':
        return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
      default:
        return 'bg-slate-500/15 text-slate-300 border-slate-500/30';
    }
  };

  return (
    <>
      <Header
        title="User Management & Identity Governance"
        subtitle="Enterprise Identity Administration, Persistent Credential Provisioning & Cryptographic Access Control"
      />

      <main className="p-6 sm:p-8 space-y-6 max-w-7xl mx-auto w-full">
          {/* Notifications */}
          {notification && (
            <div
              className={`p-4 rounded-xl border flex items-center justify-between text-xs font-medium transition-all ${
                notification.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-red-500/10 border-red-500/30 text-red-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                {notification.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                )}
                <span>{notification.message}</span>
              </div>
              <button
                onClick={() => setNotification(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
          )}

          {/* Section Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1c2b50] pb-5">
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-black text-white uppercase tracking-tight">
                  Authorized University Accounts
                </h2>
                <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[10px] font-mono font-semibold">
                  RBAC SECURED
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Manage authentication credentials, enforce statutory password rotation, and monitor account lifecycle status.
              </p>
            </div>

            <button
              onClick={fetchUsers}
              disabled={loading}
              className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-[#101F35] border border-[#1e3557] hover:border-cyan-400/50 text-xs font-semibold text-slate-200 transition-all self-start sm:self-auto cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Directory</span>
            </button>
          </div>

          {/* Summary KPI Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-[#0b132b] border border-[#1c2b50] space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Total Registered Accounts
              </span>
              <div className="text-2xl font-black text-white font-mono">{metrics.total}</div>
              <span className="text-[11px] text-slate-500 font-mono">Institutional & Students</span>
            </div>

            <div className="p-4 rounded-xl bg-[#0b132b] border border-[#1c2b50] space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Active Users
              </span>
              <div className="text-2xl font-black text-emerald-400 font-mono">{metrics.active}</div>
              <span className="text-[11px] text-emerald-500/80 font-mono">
                {metrics.total > 0 ? Math.round((metrics.active / metrics.total) * 100) : 0}% Operational
              </span>
            </div>

            <div className="p-4 rounded-xl bg-[#0b132b] border border-[#1c2b50] space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Student Portals
              </span>
              <div className="text-2xl font-black text-cyan-400 font-mono">{metrics.students}</div>
              <span className="text-[11px] text-cyan-500/80 font-mono">All Published Examinees</span>
            </div>

            <div className="p-4 rounded-xl bg-[#0b132b] border border-[#1c2b50] space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                First-Login Pending
              </span>
              <div className="text-2xl font-black text-amber-400 font-mono">{metrics.pendingReset}</div>
              <span className="text-[11px] text-amber-500/80 font-mono">Temporary Credentials Active</span>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="p-4 rounded-2xl bg-[#0b132b] border border-[#1c2b50] flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search user by name, email, or registration number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-[#111c38] border border-[#1c2b50] rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 font-mono"
              />
            </div>

            {/* Role Filter */}
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-slate-500 shrink-0" />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-2 bg-[#111c38] border border-[#1c2b50] rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-400 font-mono"
              >
                <option value="ALL">All Roles</option>
                <option value="ADMIN">ADMIN</option>
                <option value="EXAM_CONTROLLER">EXAM CONTROLLER</option>
                <option value="ACADEMIC_DEAN">ACADEMIC DEAN</option>
                <option value="AUDITOR">AUDITOR</option>
                <option value="STUDENT">STUDENT</option>
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-[#111c38] border border-[#1c2b50] rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-400 font-mono"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active Only</option>
                <option value="INACTIVE">Deactivated Only</option>
                <option value="MUST_CHANGE">Requires Password Change</option>
              </select>
            </div>
          </div>

          {/* Accounts Table */}
          <div className="rounded-2xl border border-[#1c2b50] bg-[#0b132b] overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#1c2b50] bg-[#101b38]/60 text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                    <th className="py-3.5 px-4">User / Account Identity</th>
                    <th className="py-3.5 px-4">Institutional Role</th>
                    <th className="py-3.5 px-4">Registration No</th>
                    <th className="py-3.5 px-4">Account Status</th>
                    <th className="py-3.5 px-4">Password Lifecycle</th>
                    <th className="py-3.5 px-4">Session Revocation Ver</th>
                    <th className="py-3.5 px-4 text-right">Administrative Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1c2b50]/60 text-xs">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-cyan-400" />
                        <span>Loading persistent user directory...</span>
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <Users className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                        <span>No user accounts matched the current filter criteria.</span>
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => (
                      <tr
                        key={user.id}
                        className={`hover:bg-[#111c38]/50 transition-colors ${
                          !user.isActive ? 'opacity-60 bg-red-950/5' : ''
                        }`}
                      >
                        {/* Name & Email */}
                        <td className="py-3 px-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-white text-xs">{user.name}</span>
                            <span className="text-[11px] text-slate-400 font-mono">{user.email}</span>
                          </div>
                        </td>

                        {/* Role Badge */}
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${getRoleBadge(
                              user.role
                            )}`}
                          >
                            {user.role}
                          </span>
                        </td>

                        {/* Registration Number */}
                        <td className="py-3 px-4 font-mono text-[11px]">
                          {user.studentRegNo ? (
                            <span className="text-cyan-400 font-semibold">{user.studentRegNo}</span>
                          ) : (
                            <span className="text-slate-500">N/A (Institutional)</span>
                          )}
                        </td>

                        {/* Status (Active / Inactive) */}
                        <td className="py-3 px-4">
                          {user.isActive ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono text-red-400 bg-red-500/10 border border-red-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                              Deactivated
                            </span>
                          )}
                        </td>

                        {/* Password Lifecycle Status */}
                        <td className="py-3 px-4">
                          {user.mustChangePassword ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                              <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                              Must Change
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                              <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                              Permanent Set
                            </span>
                          )}
                        </td>

                        {/* Password Version (Session Invalidation Counter) */}
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                          v{user.passwordVersion}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            {/* Reset Password Button */}
                            <button
                              onClick={() => {
                                setResetModalUser(user);
                                setCustomPassword('');
                                setUseAutoGenerate(true);
                                setForceChangeNextLogin(true);
                              }}
                              title="Reset account credentials"
                              className="px-2.5 py-1.5 rounded-lg bg-blue-600/15 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-[11px] font-semibold flex items-center space-x-1.5 transition-all cursor-pointer"
                            >
                              <KeyRound className="w-3 h-3 text-cyan-400" />
                              <span>Reset Password</span>
                            </button>

                            {/* Toggle Active Button */}
                            <button
                              onClick={() => setToggleStatusUser(user)}
                              title={user.isActive ? 'Deactivate user' : 'Activate user'}
                              className={`p-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                                user.isActive
                                  ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/30'
                                  : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                              }`}
                            >
                              {user.isActive ? (
                                <UserX className="w-3.5 h-3.5" />
                              ) : (
                                <UserCheck className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>

      {/* ========================================================================= */}
      {/* 1. Reset Password Dialog Modal */}
      {/* ========================================================================= */}
      {resetModalUser && !resetSuccessData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[#1e3557] bg-[#101F35] p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between border-b border-[#1e3557] pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-cyan-400" />
                  <span>Administrative Password Reset</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Target Account:{' '}
                  <span className="text-white font-semibold">{resetModalUser.name}</span> (
                  <span className="text-cyan-400 font-mono">{resetModalUser.email}</span>)
                </p>
              </div>
              <button
                onClick={() => setResetModalUser(null)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Reset Type Selection */}
              <div className="space-y-2">
                <label className="font-semibold text-slate-300 block">Credential Generation Mode</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setUseAutoGenerate(true)}
                    className={`p-3 rounded-xl border text-left flex flex-col space-y-1 transition-all ${
                      useAutoGenerate
                        ? 'border-cyan-400 bg-cyan-500/10 text-white'
                        : 'border-[#1e3557] bg-[#0b192e] text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    <span className="font-bold text-xs flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-cyan-400" />
                      Auto-Generate (Recommended)
                    </span>
                    <span className="text-[10px] text-slate-400">
                      16-character high-entropy cryptographic password
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setUseAutoGenerate(false)}
                    className={`p-3 rounded-xl border text-left flex flex-col space-y-1 transition-all ${
                      !useAutoGenerate
                        ? 'border-cyan-400 bg-cyan-500/10 text-white'
                        : 'border-[#1e3557] bg-[#0b192e] text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    <span className="font-bold text-xs flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-cyan-400" />
                      Specify Custom Password
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Manual temporary password meeting complexity rules
                    </span>
                  </button>
                </div>
              </div>

              {/* Custom Password Input */}
              {!useAutoGenerate && (
                <div className="space-y-1 pt-1">
                  <label className="font-semibold text-slate-300">Temporary Password</label>
                  <input
                    type="text"
                    value={customPassword}
                    onChange={(e) => setCustomPassword(e.target.value)}
                    placeholder="Min 12 chars (Upper, Lower, Number, Symbol)"
                    className="w-full px-3.5 py-2.5 bg-[#081426] border border-[#1e3557] rounded-xl text-white text-xs font-mono placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                  />
                  <p className="text-[10px] text-slate-400">
                    Must be at least 12 characters and include uppercase, lowercase, numbers, and special characters.
                  </p>
                </div>
              )}

              {/* Force Password Change Option */}
              <div className="p-3 rounded-xl bg-[#0b192e] border border-[#1e3557] flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="forceChangeCheck"
                  checked={forceChangeNextLogin}
                  onChange={(e) => setForceChangeNextLogin(e.target.checked)}
                  className="rounded border-[#1e3557] text-blue-600 focus:ring-0 focus:outline-none cursor-pointer"
                />
                <label htmlFor="forceChangeCheck" className="text-xs text-slate-300 cursor-pointer">
                  <span className="font-bold text-white block">
                    Force password change on user's next login
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Enforces statutory security compliance before the user can view academic records.
                  </span>
                </label>
              </div>

              {/* Invalidation Notice */}
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  <strong>Security Invalidation Notice:</strong> Proceeding will increment the user's cryptographic session version and revoke all existing active session tokens for this account across all devices.
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-[#1e3557]">
              <button
                type="button"
                onClick={() => setResetModalUser(null)}
                className="px-4 py-2 border border-[#1e3557] bg-[#0b192e] hover:bg-[#142642] text-slate-300 text-xs font-semibold rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteReset}
                disabled={resetting || (!useAutoGenerate && !customPassword)}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center space-x-1.5"
              >
                {resetting ? (
                  <span>Resetting Cryptographic Hash...</span>
                ) : (
                  <>
                    <span>Confirm & Reset Password</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. Reset Success Temporary Password Display Modal (Shown only once) */}
      {/* ========================================================================= */}
      {resetSuccessData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="w-full max-w-md rounded-2xl border border-emerald-500/30 bg-[#101F35] p-6 shadow-2xl space-y-5 animate-in fade-in duration-200">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">Temporary Credentials Generated</h3>
              <p className="text-xs text-slate-400">
                A new secure password has been provisioned for{' '}
                <strong className="text-white">{resetSuccessData.userName}</strong>.
              </p>
            </div>

            {/* Temporary Password Highlight Box */}
            <div className="p-4 rounded-xl bg-[#081426] border border-cyan-500/40 space-y-2">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Temporary Activation Password
              </span>
              <div className="flex items-center justify-between bg-[#0b132b] p-3 rounded-lg border border-[#1e3557]">
                <code className="text-base font-mono font-bold text-cyan-400 select-all tracking-wider">
                  {resetSuccessData.temporaryPassword}
                </code>
                <button
                  type="button"
                  onClick={() => copyToClipboard(resetSuccessData.temporaryPassword)}
                  className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center space-x-1 transition-all cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Critical Security Warning */}
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start space-x-2.5">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
              <div className="space-y-1">
                <strong className="font-semibold block">Non-Recoverable Credentials</strong>
                <p className="text-[11px] leading-relaxed text-slate-300">
                  This temporary password is displayed <strong>strictly once</strong> and cannot be retrieved by administrators after closing this dialog. Provide it securely to the account owner.
                </p>
              </div>
            </div>

            {/* Done Button */}
            <button
              type="button"
              onClick={() => {
                setResetSuccessData(null);
                setResetModalUser(null);
              }}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
            >
              I Have Securely Copied The Password
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. Account Activation / Deactivation Confirmation Dialog */}
      {/* ========================================================================= */}
      {toggleStatusUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#1e3557] bg-[#101F35] p-6 shadow-2xl space-y-4">
            <div className="flex items-start space-x-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  toggleStatusUser.isActive
                    ? 'bg-red-500/15 border border-red-500/30 text-red-400'
                    : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
                }`}
              >
                {toggleStatusUser.isActive ? (
                  <UserX className="w-5 h-5" />
                ) : (
                  <UserCheck className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  {toggleStatusUser.isActive ? 'Deactivate Account' : 'Reactivate Account'}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Are you sure you want to {toggleStatusUser.isActive ? 'deactivate' : 'activate'} the account for{' '}
                  <strong className="text-white">{toggleStatusUser.name}</strong> ({toggleStatusUser.email})?
                </p>
              </div>
            </div>

            {toggleStatusUser.isActive && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
                Deactivating this user will terminate any active authentication sessions and prevent them from logging in until reactivated.
              </div>
            )}

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-[#1e3557]">
              <button
                type="button"
                onClick={() => setToggleStatusUser(null)}
                className="px-4 py-2 border border-[#1e3557] bg-[#0b192e] hover:bg-[#142642] text-slate-300 text-xs font-semibold rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleToggleStatus}
                disabled={toggling}
                className={`px-5 py-2 text-white text-xs font-bold rounded-xl shadow-lg transition-all ${
                  toggleStatusUser.isActive
                    ? 'bg-red-600 hover:bg-red-500 shadow-red-500/20'
                    : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20'
                }`}
              >
                {toggling ? 'Processing...' : toggleStatusUser.isActive ? 'Confirm Deactivation' : 'Confirm Activation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
