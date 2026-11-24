'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import {
  Calendar,
  Plus,
  BookOpen,
  Building,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  Edit2,
  Layers,
  Award,
  ShieldCheck,
} from 'lucide-react';
import { Examination, SubjectItem } from '@/lib/types';

export default function ExaminationsPage() {
  const [examinations, setExaminations] = useState<Examination[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isExamModalOpen, setIsExamModalOpen] = useState(false);
  const [isEditExamModalOpen, setIsEditExamModalOpen] = useState(false);
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);

  const [activeExam, setActiveExam] = useState<Examination | null>(null);

  // Exam Form state
  const [examForm, setExamForm] = useState({
    examCode: '',
    examName: '',
    semester: 'Semester 8',
    academicYear: '2025-2026',
    department: 'Computer Science & Engineering',
    status: 'published' as 'draft' | 'scheduled' | 'completed' | 'published' | 'archived',
    conductedDate: '2026-05-15',
  });

  // Subject Form state
  const [subjForm, setSubjForm] = useState({
    subjectCode: '',
    subjectName: '',
    department: 'Computer Science & Engineering',
    credits: 4,
    maxMarks: 100,
    passingMarks: 40,
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchExaminations = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/examinations');
      const data = await res.json();
      if (data.success) {
        setExaminations(data.examinations);
        setSubjects(data.subjects || []);
      }
    } catch (err) {
      console.error('Failed to load examinations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExaminations();
  }, []);

  const handleOpenAddExamModal = () => {
    setExamForm({
      examCode: '',
      examName: '',
      semester: 'Semester 8',
      academicYear: '2025-2026',
      department: 'Computer Science & Engineering',
      status: 'published',
      conductedDate: '2026-05-15',
    });
    setFormError(null);
    setFormSuccess(null);
    setIsExamModalOpen(true);
  };

  const handleOpenEditExamModal = (exam: Examination) => {
    setActiveExam(exam);
    setExamForm({
      examCode: exam.examCode,
      examName: exam.examName,
      semester: exam.semester,
      academicYear: exam.academicYear,
      department: exam.department || 'Computer Science & Engineering',
      status: exam.status,
      conductedDate: exam.conductedDate,
    });
    setFormError(null);
    setFormSuccess(null);
    setIsEditExamModalOpen(true);
  };

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch('/api/examinations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(examForm),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create examination');
      }

      setFormSuccess('Examination successfully created and registered!');
      setTimeout(() => {
        setIsExamModalOpen(false);
        fetchExaminations();
      }, 1200);
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeExam) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch(`/api/examinations/${activeExam.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(examForm),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update examination');
      }

      setFormSuccess('Examination updated successfully!');
      setTimeout(() => {
        setIsEditExamModalOpen(false);
        fetchExaminations();
      }, 1200);
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Header
        title="Institutional Examination Management"
        subtitle="Manage academic examinations, curricular subject offerings, grading scales, and evaluation terms"
      />

      <main className="p-8 space-y-8 max-w-7xl">
        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#111c38] border border-[#1c2b50] rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400">Total Examinations</p>
                <h3 className="text-2xl font-bold text-white mt-1">
                  {loading ? '...' : examinations.length}
                </h3>
              </div>
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <Calendar className="w-5 h-5" />
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-3">Scheduled & Published Sessions</p>
          </div>

          <div className="bg-[#111c38] border border-[#1c2b50] rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400">Published Sessions</p>
                <h3 className="text-2xl font-bold text-emerald-400 mt-1">
                  {loading ? '...' : examinations.filter((e) => e.status === 'published').length}
                </h3>
              </div>
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-3">Results Sealed to Cryptographic Ledger</p>
          </div>

          <div className="bg-[#111c38] border border-[#1c2b50] rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400">Accredited Subjects</p>
                <h3 className="text-2xl font-bold text-cyan-400 mt-1">{loading ? '...' : subjects.length}</h3>
              </div>
              <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                <BookOpen className="w-5 h-5" />
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-3">Curricular Evaluation Units</p>
          </div>

          <div className="bg-[#111c38] border border-[#1c2b50] rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400">Active Academic Year</p>
                <h3 className="text-2xl font-bold text-purple-400 mt-1">2025-2026</h3>
              </div>
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <Clock className="w-5 h-5" />
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-3">Semester 8 Evaluation Cycle</p>
          </div>
        </div>

        {/* Examinations Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">Examination Sessions</h2>
              <p className="text-xs text-slate-400">Official institutional examination terms</p>
            </div>
            <button
              onClick={handleOpenAddExamModal}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-xs font-bold shadow-md shadow-cyan-500/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Examination</span>
            </button>
          </div>

          <div className="bg-[#111c38] border border-[#1c2b50] rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0b132b] border-b border-[#1c2b50] text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3.5 px-5">Exam Code</th>
                  <th className="py-3.5 px-5">Examination Title</th>
                  <th className="py-3.5 px-5">Semester / Term</th>
                  <th className="py-3.5 px-5">Academic Year</th>
                  <th className="py-3.5 px-5">Conducted Date</th>
                  <th className="py-3.5 px-5">Status</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1c2b50]/60">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      Loading examinations...
                    </td>
                  </tr>
                ) : examinations.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No examinations found.
                    </td>
                  </tr>
                ) : (
                  examinations.map((exam) => (
                    <tr key={exam.id} className="hover:bg-[#152347]/60 transition-colors">
                      <td className="py-3.5 px-5 font-mono text-cyan-400 font-bold">{exam.examCode}</td>
                      <td className="py-3.5 px-5 font-semibold text-white">{exam.examName}</td>
                      <td className="py-3.5 px-5 text-slate-300">{exam.semester}</td>
                      <td className="py-3.5 px-5 font-mono text-slate-400">{exam.academicYear}</td>
                      <td className="py-3.5 px-5 font-mono text-slate-400">{exam.conductedDate}</td>
                      <td className="py-3.5 px-5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${
                            exam.status === 'published'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : exam.status === 'scheduled'
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                              : exam.status === 'completed'
                              ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                              : 'bg-slate-500/10 text-slate-400 border-slate-500/30'
                          }`}
                        >
                          {exam.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <button
                          onClick={() => handleOpenEditExamModal(exam)}
                          className="px-2.5 py-1 rounded bg-[#070d1e] hover:bg-[#1a284e] border border-[#1c2b50] text-cyan-400 font-medium inline-flex items-center space-x-1"
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

        {/* Subjects & Grading Curriculum Section */}
        <div className="space-y-4 pt-4 border-t border-[#1c2b50]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">Curricular Subject Registry</h2>
              <p className="text-xs text-slate-400">Institutional credit allocation and passing thresholds</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {subjects.map((subj) => (
              <div
                key={subj.id}
                className="bg-[#111c38] border border-[#1c2b50] rounded-xl p-4 space-y-3 shadow-sm hover:border-cyan-500/40 transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-cyan-400 font-bold text-xs px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20">
                    {subj.subjectCode}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">{subj.credits} Credits</span>
                </div>
                <h4 className="font-semibold text-white text-sm leading-snug">{subj.subjectName}</h4>
                <div className="pt-2 border-t border-[#1c2b50]/60 flex items-center justify-between text-xs text-slate-400">
                  <span>Max Marks: <strong className="text-slate-200">{subj.maxMarks}</strong></span>
                  <span>Pass Threshold: <strong className="text-emerald-400">{subj.passingMarks}%</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Create Exam Modal */}
      {isExamModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b132b] border border-[#1c2b50] rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-[#1c2b50] pb-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Create Examination Session</h3>
                  <p className="text-xs text-slate-400">Register new examination term in the institutional ledger</p>
                </div>
              </div>
              <button
                onClick={() => setIsExamModalOpen(false)}
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

            <form onSubmit={handleCreateExam} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Exam Code *</label>
                  <input
                    type="text"
                    required
                    value={examForm.examCode}
                    onChange={(e) => setExamForm({ ...examForm, examCode: e.target.value })}
                    placeholder="e.g. MIDSEM-2026"
                    className="w-full px-3 py-2 rounded-lg bg-[#070d1e] border border-[#1c2b50] text-white focus:outline-none focus:border-cyan-400 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Semester / Term *</label>
                  <input
                    type="text"
                    required
                    value={examForm.semester}
                    onChange={(e) => setExamForm({ ...examForm, semester: e.target.value })}
                    placeholder="e.g. Semester 8"
                    className="w-full px-3 py-2 rounded-lg bg-[#070d1e] border border-[#1c2b50] text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Examination Title *</label>
                <input
                  type="text"
                  required
                  value={examForm.examName}
                  onChange={(e) => setExamForm({ ...examForm, examName: e.target.value })}
                  placeholder="e.g. End Semester Examination 2026"
                  className="w-full px-3 py-2 rounded-lg bg-[#070d1e] border border-[#1c2b50] text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Academic Year *</label>
                  <input
                    type="text"
                    required
                    value={examForm.academicYear}
                    onChange={(e) => setExamForm({ ...examForm, academicYear: e.target.value })}
                    placeholder="e.g. 2025-2026"
                    className="w-full px-3 py-2 rounded-lg bg-[#070d1e] border border-[#1c2b50] text-white focus:outline-none focus:border-cyan-400 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Conducted Date *</label>
                  <input
                    type="date"
                    required
                    value={examForm.conductedDate}
                    onChange={(e) => setExamForm({ ...examForm, conductedDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#070d1e] border border-[#1c2b50] text-white focus:outline-none focus:border-cyan-400 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Publication Status</label>
                <select
                  value={examForm.status}
                  onChange={(e: any) => setExamForm({ ...examForm, status: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[#070d1e] border border-[#1c2b50] text-white focus:outline-none focus:border-cyan-400"
                >
                  <option value="published">Published</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="completed">Completed</option>
                  <option value="draft">Draft</option>
                </select>
              </div>

              <div className="pt-3 flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => setIsExamModalOpen(false)}
                  className="flex-1 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold shadow-md shadow-cyan-500/20 transition-all disabled:opacity-50"
                >
                  {submitting ? 'Registering...' : 'Create Examination'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Exam Modal */}
      {isEditExamModalOpen && activeExam && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b132b] border border-[#1c2b50] rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-[#1c2b50] pb-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Edit Examination Session</h3>
                  <p className="text-xs font-mono text-cyan-400">{activeExam.examCode}</p>
                </div>
              </div>
              <button
                onClick={() => setIsEditExamModalOpen(false)}
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

            <form onSubmit={handleUpdateExam} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Examination Title</label>
                <input
                  type="text"
                  required
                  value={examForm.examName}
                  onChange={(e) => setExamForm({ ...examForm, examName: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[#070d1e] border border-[#1c2b50] text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Semester / Term</label>
                  <input
                    type="text"
                    required
                    value={examForm.semester}
                    onChange={(e) => setExamForm({ ...examForm, semester: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#070d1e] border border-[#1c2b50] text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Academic Year</label>
                  <input
                    type="text"
                    required
                    value={examForm.academicYear}
                    onChange={(e) => setExamForm({ ...examForm, academicYear: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#070d1e] border border-[#1c2b50] text-white focus:outline-none focus:border-cyan-400 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Conducted Date</label>
                  <input
                    type="date"
                    required
                    value={examForm.conductedDate}
                    onChange={(e) => setExamForm({ ...examForm, conductedDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#070d1e] border border-[#1c2b50] text-white focus:outline-none focus:border-cyan-400 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Session Status</label>
                  <select
                    value={examForm.status}
                    onChange={(e: any) => setExamForm({ ...examForm, status: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#070d1e] border border-[#1c2b50] text-white focus:outline-none focus:border-cyan-400"
                  >
                    <option value="published">Published</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="completed">Completed</option>
                    <option value="draft">Draft</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => setIsEditExamModalOpen(false)}
                  className="flex-1 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold shadow-md shadow-cyan-500/20 transition-all disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
