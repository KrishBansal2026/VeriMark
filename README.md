# VeriMark – Tamper-Proof Academic Result Ledger

> **Code Fuzion 2026 – Problem Statement H8: Tamper-Proof Exam Result Ledger**  
> A mission-critical, enterprise-grade academic results ledger powered by canonical **SHA-256 seals**, **RFC 6962 Merkle Trees with domain separation**, **Ed25519 digital signatures**, and **two-person cryptographic authorization**.

---

## 🏛️ Executive Architecture Overview

Traditional academic databases store student marks in mutable relational tables where any privileged DBA, database administrator, or SQL-injection vulnerability can silently modify grades without leaving a cryptographic trace. 

**VeriMark solves this fundamental vulnerability through a zero-trust cryptographic ledger architecture:**

1. **Deterministic Canonical Serialization & SHA-256**:
   Every student record is deterministically normalized (keys sorted alphabetically, floating-point marks rounded to 2 decimals, whitespace trimmed) before computing an immutable 256-bit hash seal.

2. **RFC 6962 Domain-Separated Merkle Tree**:
   Leaf nodes are prefixed with `0x00` and internal nodes with `0x01` prior to hashing, strictly preventing second-preimage collision attacks. Individual Merkle inclusion proofs allow instant verification of any student marksheet.

3. **Independently Protected Signed Checkpoints**:
   Periodically and upon every result publication or correction, a signed checkpoint containing the Merkle root, event sequence count, and previous checkpoint hash is digitally signed using **Ed25519** and committed to an isolated secondary storage vault (`.verimark_vault/independent_checkpoints.json`). Even a compromised primary database cannot forge a checkpoint.

4. **Two-Person Dual Ed25519 Correction Workflow**:
   Published examination records cannot be directly edited by any administrator. Any modification requires a registered administrative reason and digital signatures from two distinct authorized signatories:
   - **Controller of Examinations** (Approver 1)
   - **Dean of Academic Affairs** (Approver 2)
   Corrections are executed only after both Ed25519 signatures are verified on the backend, generating an auditable amendment event in the ledger.

5. **Direct Database Tampering Detection & Rollback**:
   An automated audit engine recalculates every record's hash from raw storage, reconstructs the Merkle tree, and compares the root against the independently authenticated signed checkpoint. If a rogue actor directly modifies a database row, VeriMark flags `TAMPER_DETECTED`, pinpoints the affected student record and exact fields, displays Expected vs Actual hashes, and enables one-click rollback to the authenticated checkpoint.

6. **Instant Public QR Verification**:
   Every marksheet generates a high-resolution QR code pointing to `/verify/[resultId]`. Scanning the code executes a dynamic, 3-layer cryptographic audit (SHA-256 seal check, Merkle proof traversal, and Ed25519 Authority signature check) in real-time. Zero hardcoded responses.

---

## 🛠️ Technology Stack

- **Framework**: Next.js 14 App Router (React 18, TypeScript)
- **Styling**: Tailwind CSS (Dark Navy `#070d1e` / `#0b132b` Enterprise Theme)
- **Icons**: Lucide Icons
- **Database**: Supabase PostgreSQL (`supabase/schema.sql`) with resilient offline vault persistence
- **Cryptography**:
  - SHA-256 with RFC 6962 leaf & internal node domain separation
  - Custom Merkle Tree with complete inclusion proof generation & verification
  - Native Node.js 32-byte Ed25519 keypair generation, signing, and verification (RFC 8410 / RFC 8032)
- **QR Codes**: `qrcode` vector engine
- **Testing**: Vitest automated test suite (22 unit, integration, and security tests)

---

## 🚀 Quick Start & Installation

### Prerequisites
- Node.js v18.0.0 or higher (v20+ recommended)
- npm or pnpm

### 1. Clone Repository & Install Dependencies
```bash
git clone https://github.com/your-username/verimark.git
cd verimark
npm install
```

### 2. Configure Environment Variables (Optional)
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
*Note: VeriMark includes a zero-config vault engine that automatically generates and protects local Ed25519 keys and checkpoints out-of-the-box for development and hackathon evaluations.*

### 3. Run Automated Cryptographic & Security Tests
```bash
npm test
```
*Executes all 22 automated positive and negative test cases covering SHA-256 determinism, RFC 6962 Merkle tree proofs, Ed25519 signatures, dual-signer enforcement, direct DB tampering detection, and checkpoint rollbacks.*

### 4. Launch Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📋 5-Minute Hackathon Demonstration Script (For Judges)

### Minute 1: The Core Problem & Admin Dashboard (0:00 - 1:00)
1. Open the **Dashboard** at `http://localhost:3000`.
2. Point out the **Active Signed Checkpoint Banner**: displays the current Merkle root, event sequence number, and Ed25519 signature status.
3. Show the pre-seeded academic results across 5 engineering students.
4. Explain how VeriMark eliminates database trust assumptions through canonical SHA-256 seals and Merkle inclusion proofs.

### Minute 2: Publishing a Student Result & QR Code (1:00 - 2:00)
1. Navigate to **Student Results** (`/results`).
2. Click **"Add Student Result"**.
3. Enter student details (e.g., `CF2026-CSE-109`, `Priyanshu Sen`, `Operating Systems`, `92.5 Marks`).
4. Ensure *"Publish and seal immediately into append-only Merkle ledger"* is checked. Click **"Commit Record"**.
5. Show that a new deterministic SHA-256 hash was generated, a new leaf was appended to the Merkle tree, and Checkpoint sequence incremented.
6. Click the **"QR"** button for the student. Show the high-res verification QR code.

### Minute 3: Public QR Verification (Zero Hardcoded Checks) (2:00 - 3:00)
1. Click **"Open Public Verification Page"** (or visit `/verify/[id]`).
2. Point out the dynamic 3-layer verification checklist:
   - **Layer 1**: Recalculated SHA-256 record hash vs expected seal.
   - **Layer 2**: Merkle inclusion proof traversal up the tree.
   - **Layer 3**: Master Ledger Authority Ed25519 digital signature check.
3. Show that the verification status is dynamically evaluated as **VERIFIED**.

### Minute 4: Direct Database Tampering Detection (3:00 - 4:00)
1. Navigate to **Security Audit** (`/audit`).
2. Note that initial state is **SECURE** (100% integrity).
3. Under the **Hackathon Stress-Test Console**, click **"1. Simulate Direct Database Tampering"**.
4. The system directly mutates a student's marks in the raw database (simulating a rogue DBA changing marks from 76 to 99.5).
5. Watch the system immediately flip to **TAMPER_DETECTED** in bold red alert!
6. Show the exact audit finding: identifies the affected student, pinpoints the discrepancy, and displays **Expected Hash vs Actual Recalculated Hash** side-by-side!
7. Re-open that student's public verification page: it now flashes **TAMPERED**!

### Minute 5: Two-Person Correction & Rollback (4:00 - 5:00)
1. Back on the **Security Audit** page, click **"2. Restore to Signed Checkpoint"** to showcase rollback to the authentic vault checkpoint. Status returns to **SECURE**.
2. Navigate to **Dual Approvals** (`/corrections`).
3. Demonstrate a legitimate administrative mark correction:
   - Step 1: Admin registers recount request with justification.
   - Step 2: **Exam Controller** reviews diff and clicks *"Sign as Exam Controller"*. Status becomes `1/2 SIGNATURES VERIFIED`.
   - Step 3: Show that duplicate signing is blocked.
   - Step 4: **Academic Dean** clicks *"Sign as Academic Dean"*.
   - Result: Both Ed25519 signatures verified on the backend, marks updated legally, and a new signed checkpoint is sealed!

---

## 🔒 Security Compliance Checklist (Problem H8)

| Mandatory Requirement | Status | Implementation Details |
|---|---|---|
| **Admin Result Management** | ✅ Implemented | Server-validated student record creation, publishing, and SHA-256 hashing. |
| **RFC 6962 Merkle Tree** | ✅ Implemented | Domain separation (`0x00` leaf, `0x01` internal), inclusion proofs, odd-leaf handling. |
| **Ed25519 Signed Checkpoints** | ✅ Implemented | Checkpoints signed via native 32-byte Ed25519 keys; keys protected on server only. |
| **Independent Checkpoint Store** | ✅ Implemented | Checkpoints committed to isolated vault (`independent_checkpoints.json`). |
| **Two-Person Approval Workflow** | ✅ Implemented | Distinct Exam Controller & Academic Dean Ed25519 signatures required for corrections. |
| **Duplicate Approval Prevention** | ✅ Implemented | Enforced on backend: identical role/approver duplicate signatures rejected. |
| **Public QR Verification** | ✅ Implemented | Unique QR codes point to `/verify/[id]`; live cryptographic checks with zero hardcoding. |
| **Direct DB Tampering Detection**| ✅ Implemented | Detects direct row modifications, shows hash diffs, and supports checkpoint rollback. |
| **PostgreSQL Schema** | ✅ Implemented | Complete Supabase DDL migrations in `supabase/schema.sql` with RLS policies. |
| **Automated Testing Suite** | ✅ Implemented | 22 comprehensive Vitest unit and integration tests passing. |

---

## 📜 License
Developed for **Code Fuzion 2026 Hackathon**. Open-source under MIT License.
