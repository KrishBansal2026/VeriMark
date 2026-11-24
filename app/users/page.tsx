'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  X,
  Lock,
  UserCheck,
  Power,
  Copy,
  Check,
  UserCog,
} from 'lucide-react';
import { UserRole } from '@/lib/types';

interface SafeUser {
  id: string;
  institutionId?: string;
  email: string;
  name: string;
  role: UserRole;
  studentRegNo?: string;
  mustChangePassword?: boolean;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export default function UsersManagementPage() {
  const [users, setUsers] = useState<SafeUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [tempCredentialDisplay, setTempCredentialDisplay] = useState<{
    email: string;
    tempPass: string;
  } | null>(null);
  const [copiedPass, setCopiedPass] = useState(false);

  // Form State
  const [newUserForm, setNewUserForm] = useState({
    name: '',
    email: '',
    role: 'FACULTY' as UserRole,
    studentRegNo: '',
    initialPassword: '',
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (data.success) {
        setUsers(data.users);
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUserForm),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to provision user account');
      }

      setIsAddModalOpen(false);
      setTempCredentialDisplay({
        email: data.user.email,
        tempPass: data.temporaryPassword,
      });

      setNewUserForm({
        name: '',
        email: '',
        role: 'FACULTY',
        studentRegNo: '',
        initialPassword: '',
      });
      fetchUsers();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (user: SafeUser) => {
    const newStatus = !user.isActive;
    const confirmMsg = newStatus
      ? `Re-activate access for ${user.name} (${user.email})?`
      : `Deactivate account for ${user.name} (${user.email})? They will be locked out immediately.`;

    if (!confirm(confirmMsg)) return;

    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        fetchUsers();
      } else {
        alert(data.error || 'Failed to update user status');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleResetPassword = async (user: SafeUser) => {
    if (!confirm(`Generate a secure temporary password reset for ${user.name} (${user.email})?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetPassword: true }),
      });
      const data = await res.json();
      if (data.success && data.temporaryPassword) {
        setTempCredentialDisplay({
          email: user.email,
          tempPass: data.temporaryPassword,
        });
        fetchUsers();
      } else {
        alert(data.error || 'Failed to reset password');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCopyTempPass = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPass(true);
    setTimeout(() => setCopiedPass(false), 2000);
  };

  // Filtering
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.studentRegNo && u.studentRegNo.toLowerCase().includes(search.toLowerCase()));

    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && u.isActive) ||
      (statusFilter === 'INACTIVE' && !u.isActive);

    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <>
      <Header
        title="User & Account Access Governance"
        subtitle="Provision institutional staff and students, manage role authorizations, and execute credential security resets"
      />

      <main className="p-8 space-y-6 max-w-7xl">
        {/* Metric Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#111c38] border border-[#1c2b50] rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400">Total Accounts</p>
                <h3 className="text-2xl font-bold text-white mt-1">{loading ? '...' : users.length}</h3>
              </div>
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-3">Registered User Directory</p>
          </div>

          <div className="bg-[#111c38] border border-[#1c2b50] rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400">Administrative Officers</p>
                <h3 className="text-2xl font-bold text-cyan-400 mt-1">
                  {loading
                    ? '...'
                    : users.filter((u) =>
                        ['ADMIN', 'INSTITUTION_ADMIN', 'SUPER_ADMIN', 'EXAM_CONTROLLER', 'ACADEMIC_DEAN'].includes(
                          u.role
                        )
                      ).length}
                </h3>
              </div>
              <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-3">Authorized Ledger Signatories</p>
          </div>

          <div className="bg-[#111c38] border border-[#1c2b50] rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400">Student Portal Logins</p>
                <h3 className="text-2xl font-bold text-purple-400 mt-1">
                  {loading ? '...' : users.filter((u) => u.role === 'STUDENT').length}
                </h3>
              </div>
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <KeyRound className="w-5 h-5" />
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-3">Individual Result Access</p>
          </div>

          <div className="bg-[#111c38] border border-[#1c2b50] rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400">Active Accounts</p>
                <h3 className="text-2xl font-bold text-emerald-400 mt-1">
                  {loading ? '...' : users.filter((u) => u.isActive).length}
                </h3>
              </div>
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <UserCheck className="w-5 h-5" />
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-3">100% Identity Validated</p>
          </div>
        </div>

        {/* Action Header */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-[#111c38] border border-[#1c2b50] rounded-xl p-4">
          <div className="flex flex-1 items-center space-x-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by user name, email, or registration no..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#070d1e] border border-[#1c2b50] text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 font-mono"
              />
            </div>

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 rounded-lg bg-[#070d1e] border border-[#1c2b50] text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
            >
              <option value="ALL">All Roles</option>
              <option value="ADMIN">ADMIN</option>
              <option value="EXAM_CONTROLLER">EXAM_CONTROLLER</option>
              <option value="ACADEMIC_DEAN">ACADEMIC_DEAN</option>
              <option value="AUDITOR">AUDITOR</option>
              <option value="FACULTY">FACULTY</option>
              <option value="STUDENT">STUDENT</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-lg bg-[#070d1e] border border-[#1c2b50] text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active Only</option>
              <option value="INACTIVE">Deactivated Only</option>
            </select>
          </div>

          <button
            onClick={() => {
              setFormError(null);
              setIsAddModalOpen(true);
            }}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-xs font-bold shadow-md shadow-cyan-500/20 transition-all cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Provision User Account</span>
          </button>
        </div>

        {/* Users Table */}
        <div className="bg-[#111c38] border border-[#1c2b50] rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0b132b] border-b border-[#1c2b50] text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3.5 px-5">User Name & Details</th>
                  <th className="py-3.5 px-5">Role Permission</th>
                  <th className="py-3.5 px-5">Reg No (If Student)</th>
                  <th className="py-3.5 px-5">Activation Status</th>
                  <th className="py-3.5 px-5">Password Policy</th>
                  <th className="py-3.5 px-5 text-right">Administrative Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1c2b50]/60">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                      Loading user accounts...
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      No accounts found matching filters.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-[#152347]/60 transition-colors">
                      <td className="py-3.5 px-5">
                        <div className="font-semibold text-white">{u.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{u.email}</div>
                      </td>
                      <td className="py-3.5 px-5">
                        <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-blue-500/10 border border-blue-500/30 text-cyan-400">
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 font-mono text-slate-300">
                        {u.studentRegNo || <span className="text-slate-500">—</span>}
                      </td>
                      <td className="py-3.5 px-5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${
                            u.isActive
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : 'bg-red-500/10 text-red-400 border-red-500/30'
                          }`}
                        >
                          {u.isActive ? 'Active' : 'Deactivated'}
                        </span>
                      </td>
                      <td className="py-3.5 px-5">
                        {u.mustChangePassword ? (
                          <span className="text-amber-400 flex items-center space-x-1 text-[11px]">
                            <span>Pending First Login Change</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Verified & Sealed</span>
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-right space-x-2">
                        <button
                          onClick={() => handleResetPassword(u)}
                          title="Generate fresh password reset"
                          className="px-2.5 py-1 rounded bg-[#070d1e] hover:bg-blue-600/20 border border-[#1c2b50] hover:border-blue-500/40 text-blue-400 font-medium inline-flex items-center space-x-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Reset Pass</span>
                        </button>

                        <button
                          onClick={() => handleToggleStatus(u)}
                          title={u.isActive ? 'Deactivate account' : 'Reactivate account'}
                          className={`px-2.5 py-1 rounded border font-medium inline-flex items-center space-x-1 ${
                            u.isActive
                              ? 'bg-red-500/10 hover:bg-red-500/20 border-red-500/30 text-red-400'
                              : 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                          }`}
                        >
                          <Power className="w-3 h-3" />
                          <span>{u.isActive ? 'Deactivate' : 'Activate'}</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Provision User Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b132b] border border-[#1c2b50] rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-[#1c2b50] pb-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Provision Account</h3>
                  <p className="text-xs text-slate-400">Create new institutional or student account</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Full Legal Name *</label>
                <input
                  type="text"
                  required
                  value={newUserForm.name}
                  onChange={(e) => setNewUserForm({ ...newUserForm, name: e.target.value })}
                  placeholder="e.g. Dr. Ada Lovelace"
                  className="w-full px-3 py-2 rounded-lg bg-[#070d1e] border border-[#1c2b50] text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Institutional Email *</label>
                <input
                  type="email"
                  required
                  value={newUserForm.email}
                  onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                  placeholder="e.g. ada.lovelace@verimark.edu"
                  className="w-full px-3 py-2 rounded-lg bg-[#070d1e] border border-[#1c2b50] text-white focus:outline-none focus:border-cyan-400 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Assigned Role *</label>
                  <select
                    value={newUserForm.role}
                    onChange={(e: any) => setNewUserForm({ ...newUserForm, role: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#070d1e] border border-[#1c2b50] text-white focus:outline-none focus:border-cyan-400 font-mono"
                  >
                    <option value="FACULTY">FACULTY</option>
                    <option value="STUDENT">STUDENT</option>
                    <option value="EXAM_CONTROLLER">EXAM_CONTROLLER</option>
                    <option value="ACADEMIC_DEAN">ACADEMIC_DEAN</option>
                    <option value="AUDITOR">AUDITOR</option>
                    <option value="ADMIN">INSTITUTION_ADMIN (ADMIN)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Student Reg No (If Student)</label>
                  <input
                    type="text"
                    value={newUserForm.studentRegNo}
                    onChange={(e) => setNewUserForm({ ...newUserForm, studentRegNo: e.target.value })}
                    placeholder="e.g. CF2026-CSE-108"
                    className="w-full px-3 py-2 rounded-lg bg-[#070d1e] border border-[#1c2b50] text-white focus:outline-none focus:border-cyan-400 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Custom Temporary Password (Optional — Auto-generated if blank)
                </label>
                <input
                  type="text"
                  value={newUserForm.initialPassword}
                  onChange={(e) => setNewUserForm({ ...newUserForm, initialPassword: e.target.value })}
                  placeholder="Leave blank for secure auto-generated temporary password"
                  className="w-full px-3 py-2 rounded-lg bg-[#070d1e] border border-[#1c2b50] text-white focus:outline-none focus:border-cyan-400 font-mono"
                />
              </div>

              <div className="pt-3 flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold shadow-md shadow-cyan-500/20 transition-all disabled:opacity-50"
                >
                  {submitting ? 'Provisioning...' : 'Provision User Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Temporary Credential Modal Display */}
      {tempCredentialDisplay && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b132b] border border-cyan-500/40 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center mx-auto">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">Temporary Credentials Issued</h3>
              <p className="text-xs text-slate-300">
                Please deliver these credentials securely to the user. They will be required to choose a new password
                upon login.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#070d1e] border border-[#1c2b50] space-y-2">
              <div className="text-xs text-slate-400">Account: <span className="text-white font-mono">{tempCredentialDisplay.email}</span></div>
              <div className="flex items-center justify-between pt-2 border-t border-[#1c2b50]">
                <span className="text-xs font-semibold text-slate-300">Temporary Password:</span>
                <div className="flex items-center space-x-2">
                  <code className="text-cyan-400 font-mono font-bold text-sm bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/30">
                    {tempCredentialDisplay.tempPass}
                  </code>
                  <button
                    onClick={() => handleCopyTempPass(tempCredentialDisplay.tempPass)}
                    className="p-1 rounded bg-[#111c38] text-slate-300 hover:text-white"
                  >
                    {copiedPass ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={() => setTempCredentialDisplay(null)}
              className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-md transition-all"
            >
              Done & Dismiss
            </button>
          </div>
        </div>
      )}
    </>
  );
}
