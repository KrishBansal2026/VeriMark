'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import {
  Network,
  ShieldCheck,
  Key,
  Layers,
  ArrowDown,
  CheckCircle2,
  RefreshCw,
  Copy,
  ExternalLink,
  Lock,
} from 'lucide-react';
import { LedgerCheckpoint, LedgerEvent } from '@/lib/types';

export default function LedgerExplorerPage() {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<LedgerEvent[]>([]);
  const [checkpoints, setCheckpoints] = useState<LedgerCheckpoint[]>([]);
  const [independentCheckpoints, setIndependentCheckpoints] = useState<LedgerCheckpoint[]>([]);
  const [publicKeys, setPublicKeys] = useState<any>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const fetchLedgerData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ledger');
      const data = await res.json();
      if (data.success) {
        setEvents(data.events);
        setCheckpoints(data.checkpoints);
        setIndependentCheckpoints(data.independentCheckpoints || []);
        setPublicKeys(data.publicKeys);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLedgerData();
  }, []);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const latestCheckpoint = checkpoints[checkpoints.length - 1];

  return (
    <>
      <Header
        title="Cryptographic Ledger Explorer"
        subtitle="Inspect append-only event blocks, Merkle tree roots, and Ed25519 signed checkpoints"
      />

      <main className="p-8 space-y-8 max-w-7xl">
        {/* Top Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-[#111c38] border border-[#1c2b50] rounded-xl p-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">Committed Checkpoints</span>
              <Network className="w-4 h-4 text-cyan-400" />
            </div>
            <h3 className="text-2xl font-bold text-white">
              {loading ? '...' : checkpoints.length}
            </h3>
            <p className="text-xs text-slate-400">
              Latest sequence: #{latestCheckpoint?.sequenceNumber ?? 0}
            </p>
          </div>

          <div className="bg-[#111c38] border border-[#1c2b50] rounded-xl p-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">Append-Only Events</span>
              <Layers className="w-4 h-4 text-blue-400" />
            </div>
            <h3 className="text-2xl font-bold text-white">
              {loading ? '...' : events.length}
            </h3>
            <p className="text-xs text-slate-400">Verifiable event hash sequence</p>
          </div>

          <div className="bg-[#111c38] border border-[#1c2b50] rounded-xl p-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">Independent Vault Status</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-base font-bold text-emerald-400">Synchronized & Protected</span>
            </div>
            <p className="text-xs text-slate-400">
              {independentCheckpoints.length} checkpoints in secondary storage
            </p>
          </div>
        </div>

        {/* Public Keys Registry */}
        {publicKeys && (
          <div className="bg-[#111c38] border border-[#1c2b50] rounded-xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <Key className="w-4 h-4 text-blue-400" />
              <span>Authorized Ed25519 Public Key Ring</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-3 rounded-lg bg-[#0b132b] border border-[#1c2b50] space-y-1">
                <div className="font-semibold text-slate-200">
                  {publicKeys.ledgerAuthority.name}
                </div>
                <div className="text-[10px] text-cyan-400 uppercase font-mono">
                  Master Ledger Signer
                </div>
                <div className="font-mono text-[11px] text-slate-400 break-all pt-1 flex items-center justify-between">
                  <span>{publicKeys.ledgerAuthority.publicKey.substring(0, 24)}...</span>
                  <button
                    onClick={() => handleCopy(publicKeys.ledgerAuthority.publicKey)}
                    className="text-slate-400 hover:text-white ml-2"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-[#0b132b] border border-[#1c2b50] space-y-1">
                <div className="font-semibold text-slate-200">{publicKeys.approver1.name}</div>
                <div className="text-[10px] text-amber-400 uppercase font-mono">
                  Approver 1 (Exam Controller)
                </div>
                <div className="font-mono text-[11px] text-slate-400 break-all pt-1 flex items-center justify-between">
                  <span>{publicKeys.approver1.publicKey.substring(0, 24)}...</span>
                  <button
                    onClick={() => handleCopy(publicKeys.approver1.publicKey)}
                    className="text-slate-400 hover:text-white ml-2"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-[#0b132b] border border-[#1c2b50] space-y-1">
                <div className="font-semibold text-slate-200">{publicKeys.approver2.name}</div>
                <div className="text-[10px] text-purple-400 uppercase font-mono">
                  Approver 2 (Academic Dean)
                </div>
                <div className="font-mono text-[11px] text-slate-400 break-all pt-1 flex items-center justify-between">
                  <span>{publicKeys.approver2.publicKey.substring(0, 24)}...</span>
                  <button
                    onClick={() => handleCopy(publicKeys.approver2.publicKey)}
                    className="text-slate-400 hover:text-white ml-2"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Signed Checkpoints History */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white tracking-tight flex items-center space-x-2">
              <Network className="w-5 h-5 text-cyan-400" />
              <span>Signed Ledger Checkpoints</span>
            </h3>
            <button
              onClick={fetchLedgerData}
              className="p-1.5 rounded-lg border border-[#1c2b50] bg-[#111c38] text-slate-400 hover:text-white"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="space-y-4">
            {checkpoints.map((chk) => (
              <div
                key={chk.id}
                className="bg-[#111c38] border border-[#1c2b50] rounded-xl p-5 space-y-3 relative overflow-hidden"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1c2b50]/60 pb-3">
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-0.5 rounded-md bg-blue-500/20 text-blue-400 text-xs font-bold font-mono">
                      Checkpoint #{chk.sequenceNumber}
                    </span>
                    <span className="text-xs text-slate-400">
                      Committed: {new Date(chk.committedAt).toLocaleString()}
                    </span>
                  </div>
                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Ed25519 Signature Verified</span>
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs font-mono">
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 uppercase font-sans font-semibold">
                      Merkle Root ({chk.leafCount} leaves)
                    </span>
                    <div className="p-2 rounded bg-[#070d1e] border border-[#1c2b50] text-cyan-300 break-all text-[11px] flex items-center justify-between">
                      <span>{chk.merkleRoot}</span>
                      <button
                        onClick={() => handleCopy(chk.merkleRoot)}
                        className="text-slate-400 hover:text-white ml-2"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 uppercase font-sans font-semibold">
                      Previous Checkpoint Hash
                    </span>
                    <div className="p-2 rounded bg-[#070d1e] border border-[#1c2b50] text-slate-400 break-all text-[11px]">
                      {chk.prevCheckpointHash}
                    </div>
                  </div>
                </div>

                <div className="pt-1">
                  <span className="text-[10px] text-slate-400 uppercase font-sans font-semibold block mb-1">
                    Digital Signature (Ed25519 64-byte Hex)
                  </span>
                  <div className="p-2 rounded bg-[#070d1e] border border-[#1c2b50] text-emerald-400 font-mono text-[11px] break-all">
                    {chk.signature}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Append-Only Event Sequence */}
        <div className="space-y-4">
          <h3 className="text-base font-bold text-white tracking-tight flex items-center space-x-2">
            <Layers className="w-5 h-5 text-blue-400" />
            <span>Append-Only Event Stream</span>
          </h3>

          <div className="bg-[#111c38] border border-[#1c2b50] rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#0b132b]/90 border-b border-[#1c2b50] text-slate-400 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Seq #</th>
                    <th className="py-3 px-4 font-semibold">Event Type</th>
                    <th className="py-3 px-4 font-semibold">Student / Entity</th>
                    <th className="py-3 px-4 font-semibold">Payload Hash</th>
                    <th className="py-3 px-4 font-semibold">Chain Hash</th>
                    <th className="py-3 px-4 font-semibold">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1c2b50]/60 font-mono">
                  {events.map((e) => (
                    <tr key={e.id} className="hover:bg-[#162244] transition-colors">
                      <td className="py-3 px-4 text-cyan-400 font-bold">#{e.sequenceNumber}</td>
                      <td className="py-3 px-4 font-sans font-medium text-slate-200">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${
                            e.eventType === 'RESULT_PUBLISHED'
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          }`}
                        >
                          {e.eventType}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-sans text-slate-300">
                        {e.studentRegNo || 'SYSTEM'}
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-[11px]">
                        {e.payloadHash.substring(0, 16)}...
                      </td>
                      <td className="py-3 px-4 text-emerald-400 text-[11px]">
                        {e.eventHash.substring(0, 16)}...
                      </td>
                      <td className="py-3 px-4 font-sans text-slate-400 text-[11px]">
                        {new Date(e.createdAt).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
