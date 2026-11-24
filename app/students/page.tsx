'use client';

import { useState, useEffect, useRef } from 'react';
import Header from '@/components/Header';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  X,
  Edit2,
  FileText,
  Mail,
  GraduationCap,
  Building,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { StudentProfile } from '@/lib/types';

export default function StudentsPage() {
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [activeStudent, setActiveStudent] = useState<StudentProfile | null>(null);

  // Form states
  const [form, setForm] = useState({
    regNo: '',
    fullName: '',
    email: '',
    course: 'B.Tech Computer Science & Engineering',
    department: 'Computer Science & Engineering',
    batchYear: '2022-2026',
    status: 'active' as 'active' | 'graduated' | 'suspended',
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // CSV Import State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/students');
      const data = await res.json();
      if (data.success) {
        setStudents(data.students);
      }
    } catch (err) {
      console.error('Failed to load students:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const handleOpenAddModal = () => {
    setForm({
      regNo: '',
      fullName: '',
      email: '',
      course: 'B.Tech Computer Science & Engineering',
      department: 'Computer Science & Engineering',
      batchYear: '2022-2026',
      status: 'active',
    });
    setFormError(null);
    setFormSuccess(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (student: StudentProfile) => {
    setActiveStudent(student);
    setForm({
      regNo: student.regNo,
      fullName: student.fullName,
      email: student.email,
      course: student.course,
      department: student.department,
      batchYear: student.batchYear,
      status: student.status,
    });
    setFormError(null);
    setFormSuccess(null);
    setIsEditModalOpen(true);
  };

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create student');
      }

      setFormSuccess('Student profile successfully registered in directory!');
      setTimeout(() => {
        setIsAddModalOpen(false);
        fetchStudents();
      }, 1200);
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStudent) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch(`/api/students/${activeStudent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update student profile');
      }

      setFormSuccess('Student profile updated successfully!');
      setTimeout(() => {
        setIsEditModalOpen(false);
        fetchStudents();
      }, 1200);
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // CSV File Handler
  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
      if (lines.length < 2) {
        setImportErrors(['CSV file is empty or missing data rows']);
        return;
      }

      const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
      const rows = [];
      const errors = [];

      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',').map((p) => p.trim());
        if (parts.length >= 4) {
          rows.push({
            regNo: parts[0],
            fullName: parts[1],
            email: parts[2],
            course: parts[3],
            department: parts[4] || 'Computer Science & Engineering',
            batchYear: parts[5] || '2022-2026',
          });
        } else {
          errors.push(`Line ${i + 1}: Insufficient columns`);
        }
      }

      setCsvPreview(rows);
      setImportErrors(errors);
    };
    reader.readAsText(file);
  };

  const handleExecuteImport = async () => {
    if (csvPreview.length === 0) return;
    setImporting(true);
    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ students: csvPreview }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Bulk import failed');
      }

      alert(`Successfully imported ${data.importedCount} student records!`);
      setIsImportModalOpen(false);
      setCsvPreview([]);
      fetchStudents();
    } catch (err: any) {
      alert(`Import error: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  const handleExportCsv = () => {
    if (students.length === 0) return;
    const headers = ['Registration No', 'Full Name', 'Email', 'Course', 'Department', 'Batch Year', 'Status'];
    const csvContent = [
      headers.join(','),
      ...students.map((s) =>
        [
          `"${s.regNo}"`,
          `"${s.fullName}"`,
          `"${s.email}"`,
          `"${s.course}"`,
          `"${s.department}"`,
          `"${s.batchYear}"`,
          `"${s.status}"`,
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `students_roster_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter students
  const filteredStudents = students.filter((s) => {
    const matchesSearch =
      s.fullName.toLowerCase().includes(search.toLowerCase()) ||
      s.regNo.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase());

    const matchesDept = departmentFilter === 'ALL' || s.department === departmentFilter;
    const matchesStatus = statusFilter === 'ALL' || s.status.toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesDept && matchesStatus;
  });

  const distinctDepartments = Array.from(new Set(students.map((s) => s.department)));

  return (
    <>
      <Header
        title="Institutional Student Directory"
        subtitle="Manage enrolled students, academic courses, department affiliations, and account activation"
      />

      <main className="p-8 space-y-6 max-w-7xl">
        {/* Metric Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#111c38] border border-[#1c2b50] rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400">Total Enrolled</p>
                <h3 className="text-2xl font-bold text-white mt-1">{loading ? '...' : students.length}</h3>
              </div>
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-3">Verified Institutional Roster</p>
          </div>

          <div className="bg-[#111c38] border border-[#1c2b50] rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400">Active Students</p>
                <h3 className="text-2xl font-bold text-emerald-400 mt-1">
                  {loading ? '...' : students.filter((s) => s.status === 'active').length}
                </h3>
              </div>
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-3">Eligible for Examination Results</p>
          </div>

          <div className="bg-[#111c38] border border-[#1c2b50] rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400">Academic Departments</p>
                <h3 className="text-2xl font-bold text-cyan-400 mt-1">
                  {loading ? '...' : distinctDepartments.length || 1}
                </h3>
              </div>
              <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                <Building className="w-5 h-5" />
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-3">Active Curricular Programs</p>
          </div>

          <div className="bg-[#111c38] border border-[#1c2b50] rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400">Current Cohort</p>
                <h3 className="text-2xl font-bold text-purple-400 mt-1">2022-2026</h3>
              </div>
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <GraduationCap className="w-5 h-5" />
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-3">B.Tech Engineering Class</p>
          </div>
        </div>

        {/* Action Header: Search, Filter, Add, Import, Export */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-[#111c38] border border-[#1c2b50] rounded-xl p-4">
          <div className="flex flex-1 items-center space-x-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name, registration no, or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#070d1e] border border-[#1c2b50] text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 font-mono"
              />
            </div>

            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="px-3 py-2 rounded-lg bg-[#070d1e] border border-[#1c2b50] text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
            >
              <option value="ALL">All Departments</option>
              {distinctDepartments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-lg bg-[#070d1e] border border-[#1c2b50] text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
            >
              <option value="ALL">All Statuses</option>
              <option value="active">Active</option>
              <option value="graduated">Graduated</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleExportCsv}
              className="flex items-center space-x-1.5 px-3 py-2 rounded-lg border border-[#1c2b50] bg-[#0b132b] hover:bg-[#1a284e] text-slate-200 text-xs font-medium transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center space-x-1.5 px-3 py-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-xs font-semibold transition-all"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Bulk CSV Import</span>
            </button>

            <button
              onClick={handleOpenAddModal}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-xs font-bold shadow-md shadow-cyan-500/20 transition-all cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add Student</span>
            </button>
          </div>
        </div>

        {/* Students Table */}
        <div className="bg-[#111c38] border border-[#1c2b50] rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0b132b] border-b border-[#1c2b50] text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3.5 px-5">Registration No</th>
                  <th className="py-3.5 px-5">Student Name</th>
                  <th className="py-3.5 px-5">Course Program</th>
                  <th className="py-3.5 px-5">Department</th>
                  <th className="py-3.5 px-5">Batch Cohort</th>
                  <th className="py-3.5 px-5">Status</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1c2b50]/60">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                      Loading verified student directory...
                    </td>
                  </tr>
                ) : filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      No students found matching current filters.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((s) => (
                    <tr key={s.id} className="hover:bg-[#152347]/60 transition-colors">
                      <td className="py-3.5 px-5 font-mono text-cyan-400 font-bold">{s.regNo}</td>
                      <td className="py-3.5 px-5">
                        <div className="font-semibold text-white">{s.fullName}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{s.email}</div>
                      </td>
                      <td className="py-3.5 px-5 text-slate-300">{s.course}</td>
                      <td className="py-3.5 px-5 text-slate-400">{s.department}</td>
                      <td className="py-3.5 px-5 font-mono text-slate-400">{s.batchYear}</td>
                      <td className="py-3.5 px-5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${
                            s.status === 'active'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : s.status === 'graduated'
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                              : 'bg-red-500/10 text-red-400 border-red-500/30'
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <button
                          onClick={() => handleOpenEditModal(s)}
                          className="px-2.5 py-1 rounded bg-[#070d1e] hover:bg-[#1a284e] border border-[#1c2b50] text-cyan-400 hover:text-cyan-300 font-medium inline-flex items-center space-x-1"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Edit</span>
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

      {/* Add Student Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b132b] border border-[#1c2b50] rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-[#1c2b50] pb-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Enroll New Student</h3>
                  <p className="text-xs text-slate-400">Register verified institutional student profile</p>
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

            {formSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{formSuccess}</span>
              </div>
            )}

            <form onSubmit={handleCreateStudent} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Registration No *</label>
                  <input
                    type="text"
                    required
                    value={form.regNo}
                    onChange={(e) => setForm({ ...form, regNo: e.target.value })}
                    placeholder="e.g. CF2026-CSE-106"
                    className="w-full px-3 py-2 rounded-lg bg-[#070d1e] border border-[#1c2b50] text-white focus:outline-none focus:border-cyan-400 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Full Legal Name *</label>
                  <input
                    type="text"
                    required
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                    placeholder="e.g. Ananya Sen"
                    className="w-full px-3 py-2 rounded-lg bg-[#070d1e] border border-[#1c2b50] text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Institutional Email *</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="e.g. ananya.sen@student.verimark.edu"
                  className="w-full px-3 py-2 rounded-lg bg-[#070d1e] border border-[#1c2b50] text-white focus:outline-none focus:border-cyan-400 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Course Program *</label>
                  <input
                    type="text"
                    required
                    value={form.course}
                    onChange={(e) => setForm({ ...form, course: e.target.value })}
                    placeholder="e.g. B.Tech Computer Science"
                    className="w-full px-3 py-2 rounded-lg bg-[#070d1e] border border-[#1c2b50] text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Department *</label>
                  <input
                    type="text"
                    required
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                    placeholder="e.g. Computer Science & Engineering"
                    className="w-full px-3 py-2 rounded-lg bg-[#070d1e] border border-[#1c2b50] text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Batch Cohort</label>
                  <input
                    type="text"
                    value={form.batchYear}
                    onChange={(e) => setForm({ ...form, batchYear: e.target.value })}
                    placeholder="e.g. 2022-2026"
                    className="w-full px-3 py-2 rounded-lg bg-[#070d1e] border border-[#1c2b50] text-white focus:outline-none focus:border-cyan-400 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Enrollment Status</label>
                  <select
                    value={form.status}
                    onChange={(e: any) => setForm({ ...form, status: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#070d1e] border border-[#1c2b50] text-white focus:outline-none focus:border-cyan-400"
                  >
                    <option value="active">Active</option>
                    <option value="graduated">Graduated</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
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
                  {submitting ? 'Registering...' : 'Register Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Student Modal */}
      {isEditModalOpen && activeStudent && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b132b] border border-[#1c2b50] rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-[#1c2b50] pb-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Edit Student Profile</h3>
                  <p className="text-xs font-mono text-cyan-400">{activeStudent.regNo}</p>
                </div>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
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

            {formSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{formSuccess}</span>
              </div>
            )}

            <form onSubmit={handleUpdateStudent} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Full Legal Name</label>
                <input
                  type="text"
                  required
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[#070d1e] border border-[#1c2b50] text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[#070d1e] border border-[#1c2b50] text-white focus:outline-none focus:border-cyan-400 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Course Program</label>
                  <input
                    type="text"
                    required
                    value={form.course}
                    onChange={(e) => setForm({ ...form, course: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#070d1e] border border-[#1c2b50] text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Department</label>
                  <input
                    type="text"
                    required
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#070d1e] border border-[#1c2b50] text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Batch Year</label>
                  <input
                    type="text"
                    value={form.batchYear}
                    onChange={(e) => setForm({ ...form, batchYear: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#070d1e] border border-[#1c2b50] text-white focus:outline-none focus:border-cyan-400 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={(e: any) => setForm({ ...form, status: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#070d1e] border border-[#1c2b50] text-white focus:outline-none focus:border-cyan-400"
                  >
                    <option value="active">Active</option>
                    <option value="graduated">Graduated</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold shadow-md shadow-cyan-500/20 transition-all disabled:opacity-50"
                >
                  {submitting ? 'Updating...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk CSV Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b132b] border border-[#1c2b50] rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-[#1c2b50] pb-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Bulk Import Student Roster (CSV)</h3>
                  <p className="text-xs text-slate-400">Upload multiple students with automated schema verification</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsImportModalOpen(false);
                  setCsvPreview([]);
                  setImportErrors([]);
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-[#070d1e] border border-[#1c2b50] space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300">Expected CSV Format:</span>
                <span className="font-mono text-cyan-400">regNo, fullName, email, course, department, batchYear</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Example: <code className="text-cyan-400/90 font-mono">CF2026-CSE-107, Rahul Mehta, rahul@student.verimark.edu, B.Tech CSE, CSE, 2022-2026</code>
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleCsvFileChange}
                className="w-full text-xs text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-600/20 file:text-cyan-400 hover:file:bg-blue-600/30 cursor-pointer"
              />
            </div>

            {importErrors.length > 0 && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs space-y-1 max-h-32 overflow-y-auto font-mono">
                {importErrors.map((err, i) => (
                  <div key={i}>• {err}</div>
                ))}
              </div>
            )}

            {csvPreview.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-emerald-400">
                    Preview: {csvPreview.length} valid records ready to import
                  </span>
                </div>
                <div className="max-h-48 overflow-y-auto rounded-lg border border-[#1c2b50] bg-[#070d1e]">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-[#0b132b] text-slate-400 text-[10px]">
                      <tr>
                        <th className="py-2 px-3">Reg No</th>
                        <th className="py-2 px-3">Name</th>
                        <th className="py-2 px-3">Email</th>
                        <th className="py-2 px-3">Course</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1c2b50]">
                      {csvPreview.slice(0, 10).map((row, idx) => (
                        <tr key={idx}>
                          <td className="py-2 px-3 text-cyan-400">{row.regNo}</td>
                          <td className="py-2 px-3 text-slate-200">{row.fullName}</td>
                          <td className="py-2 px-3 text-slate-400">{row.email}</td>
                          <td className="py-2 px-3 text-slate-400">{row.course}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="pt-2 flex items-center space-x-3">
              <button
                type="button"
                onClick={() => {
                  setIsImportModalOpen(false);
                  setCsvPreview([]);
                }}
                className="flex-1 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteImport}
                disabled={csvPreview.length === 0 || importing}
                className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold text-xs shadow-md shadow-cyan-500/20 transition-all disabled:opacity-50"
              >
                {importing ? 'Importing Roster...' : `Import ${csvPreview.length} Students`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
