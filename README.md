# VeriMark – Production Multi-Tenant Academic Result Ledger SaaS

> **Commercial-Grade Academic Integrity & Tamper-Evident Examination Ledger Platform**  
> Designed for Universities, Colleges, and Autonomous Educational Institutions. Powered by **Canonical SHA-256 Seals**, **RFC 6962 Domain-Separated Merkle Trees**, **Native Ed25519 Digital Signatures**, and **Two-Person (M-of-N) Cryptographic Governance**.

---

## 🏛️ Executive Architecture & SaaS Transformation

VeriMark transforms traditional mutable academic record databases into a **zero-trust, multi-tenant cryptographic ledger**. In conventional university ERP systems, a rogue database administrator, compromised service account, or SQL-injection exploit can silently modify grades without leaving a verifiable trace. 

**VeriMark eliminates trust assumptions through continuous cryptographic verification:**

```
                    ┌────────────────────────────────────────────────────────┐
                    │               INSTITUTION TENANCY LAYER                │
                    │   Isolated Tenant DB Scopes • Distinct Keypairs • RLS  │
                    └───────────────────────────┬────────────────────────────┘
                                                │
       ┌────────────────────────────────────────┼────────────────────────────────────────┐
       ▼                                        ▼                                        ▼
┌──────────────┐                        ┌──────────────┐                        ┌──────────────┐
│   STUDENTS   │                        │ EXAMINATIONS │                        │ RESULTS/MARKS│
│  Directory & │                        │  Sessions,   │                        │  Bulk CSV &  │
│ Rosters (CSV)│                        │  Thresholds  │                        │ Individual   │
└──────┬───────┘                        └──────┬───────┘                        └──────┬───────┘
       │                                        │                                      │
       └────────────────────────────────────────┼──────────────────────────────────────┘
                                                ▼
                               ┌─────────────────────────────────┐
                               │   DETERMINISTIC SERIALIZATION   │
                               │  Sorted Keys • Normalized Types │
                               └────────────────┬────────────────┘
                                                ▼
                               ┌─────────────────────────────────┐
                               │       CANONICAL SHA-256         │
                               │   Immutable Record Seal Hash    │
                               └────────────────┬────────────────┘
                                                ▼
                               ┌─────────────────────────────────┐
                               │     RFC 6962 MERKLE TREE        │
                               │ 0x00 Leaf Hash • 0x01 Node Hash │
                               └────────────────┬────────────────┘
                                                ▼
                               ┌─────────────────────────────────┐
                               │      INDEPENDENT CHECKPOINT     │
                               │   Ed25519 Signatures • Sequence │
                               └────────────────┬────────────────┘
                                                │
                     ┌──────────────────────────┴──────────────────────────┐
                     ▼                                                     ▼
       ┌──────────────────────────┐                          ┌──────────────────────────┐
       │   TAMPER DETECTION &     │                          │  PUBLIC QR VERIFICATION  │
       │ ONE-CLICK AUTO-ROLLBACK  │                          │  3-Layer Zero-Hardcode   │
       └──────────────────────────┘                          └──────────────────────────┘
```

---

## 🔐 Core Security & Governance Pillars

### 1. Multi-Tenant Enterprise SaaS Architecture
- **Tenant Isolation**: Every result, student, examination, ledger event, checkpoint, and audit log is strictly scoped by `institution_id`.
- **Hierarchical RBAC**:
  - `SUPER_ADMIN`: Cross-tenant platform provisioning and institution onboarding.
  - `INSTITUTION_ADMIN` / `ADMIN`: Institution-level user administration, student rosters, exam management.
  - `EXAM_CONTROLLER`: Signer 1 for two-person mark corrections.
  - `ACADEMIC_DEAN`: Signer 2 for two-person mark corrections.
  - `AUDITOR`: Independent read-only verification of cryptographic checkpoints and tamper detection.
  - `FACULTY`: Subject-level evaluation views.
  - `STUDENT`: Read-only authenticated access to personal marksheet, semester history, and QR verification.

### 2. Deterministic Serialization & SHA-256
Every result payload is canonically ordered with alphabetical keys, numeric normalization, and normalized timestamps prior to computing the 256-bit SHA-256 seal. No two records can produce the same hash, and no field can be altered without invalidating the seal.

### 3. RFC 6962 Domain-Separated Merkle Trees
Leaf hashes are prefixed with domain byte `0x00` (`SHA-256(0x00 || recordHash)`), and internal branch nodes are prefixed with `0x01` (`SHA-256(0x01 || leftChild || rightChild)`). This strictly prevents second-preimage collision attacks and length-extension vulnerabilities.

### 4. Two-Person Rule (M-of-N) Dual Ed25519 Signatures
Under university examination statutes, no single administrator can modify published marks. Corrections require:
1. Formal administrative reason and discrepancy filing.
2. Independent Ed25519 digital signature from the **Controller of Examinations**.
3. Independent Ed25519 digital signature from the **Dean of Academic Affairs**.
4. Duplicate signatures by the same officer or self-approval by the requester are strictly blocked at the backend.

### 5. Automated Tamper Detection & Checkpoint Rollback
A background audit engine recalculates every database row's hash, recomputes the Merkle tree, and compares the root against the independently authenticated signed checkpoint. If a rogue DBA alters a row directly:
- The system immediately triggers a `CRITICAL: TAMPER_DETECTED` alert.
- Pinpoints the tampered student, subject, and exact field values.
- Displays **Expected Hash vs Actual Recalculated Hash**.
- Enables one-click rollback to restore database integrity from verified checkpoints.

### 6. Brute-Force Rate Limiting & Token Revocation
- Sliding-window rate limiter (15 attempts / 15 minutes) protecting `/api/auth/login`.
- Immediate server-side token revocation on logout (`/api/auth/logout`) stored in persistent blacklist.
- Mandatory first-login password update for temporary activation credentials.

---

## 🛠️ Complete Technology Stack

- **Frontend & Full-Stack**: Next.js 14 App Router (React 18, TypeScript)
- **Styling**: Tailwind CSS with enterprise Dark Navy (`#070d1e` / `#0b132b`) theme
- **Database Architecture**:
  - Primary: Supabase PostgreSQL (`supabase/schema.sql` and `supabase/migrations/001_saas_schema.sql`) with Row-Level Security (RLS) policies.
  - Resilient Fallback: Isolated local vault storage adapter ensuring zero deployment failures on serverless runtimes.
- **Cryptography Engine**:
  - SHA-256 with RFC 6962 domain separation
  - Custom binary Merkle Tree with complete audit path traversal
  - Native Node.js 32-byte Ed25519 keypair generation, signing, and verification (RFC 8410 / RFC 8032)
  - scrypt / PBKDF2 password hashing with cryptographically secure random salts
- **Verification Engine**: Dynamic vector QR code generation pointing to `/verify/[resultId]` with zero hardcoded responses.
- **Automated Test Suite**: Vitest (193 automated tests across 12 test files).

---

## 📂 Navigation & Page Directory

| Route | Role Access | Description |
|---|---|---|
| `/` | Admin, Auditor, Faculty | Institutional Examination Dashboard with real-time stats and audit stream |
| `/students` | Admin, Institution Admin | Student Directory: single enrollment, department filters, bulk CSV import/export |
| `/examinations` | Admin, Exam Controller | Examination Management: session tracking, subject catalogue, thresholds |
| `/results` | Admin, Institution Admin | Result Management: mark entries, bulk CSV marksheet upload, CSV export |
| `/corrections` | Controller, Dean, Admin | Two-person dual-signer correction workflow with Ed25519 verification |
| `/users` | Admin, Institution Admin | User Management: staff provisioning, activation toggle, temporary passwords |
| `/ledger` | Admin, Auditor | Cryptographic Ledger Explorer: event chain, checkpoints, Merkle roots |
| `/audit` | Admin, Auditor | Security Audit Console: tamper detection, stress-test tools, checkpoint rollback |
| `/analytics` | Admin, Faculty | Academic performance intelligence, grade distribution, pass/fail diagnostics |
| `/student` | Student | Student Academic Intelligence Overview with benchmarks and filters |
| `/student/results` | Student | Student published results list with QR verification codes |
| `/student/marksheet` | Student | Official digital marksheet certificate with print-to-PDF formatting |
| `/student/history` | Student | Chronological examination timeline and semester breakdown |
| `/student/corrections`| Student | Student audit trail of statutory mark amendment requests |
| `/verify/[id]` | Public | 3-layer cryptographic verification page for scanned QR codes |

---

## 🚀 Installation & Local Development

### Prerequisites
- Node.js 18.x or 20.x
- npm or pnpm

### 1. Clone & Install
```bash
git clone https://github.com/KrishBansal2026/VeriMark.git
cd VeriMark
npm install
```

### 2. Run Test Suite
```bash
npm test
```
*Executes all 193 automated unit, integration, RBAC, adversarial, and cryptographic tests.*

### 3. Build for Production
```bash
npm run build
```

### 4. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔑 Pre-Configured Test Credentials

| Role | Email | Password | Description |
|---|---|---|---|
| **SaaS Super Admin** | `superadmin@verimark.saas` | `SuperAdmin@2026!` | Multi-tenant platform supervisor |
| **Institution Admin** | `admin@verimark.edu` | `Admin@2026!` | Chief Academic Officer |
| **Exam Controller** | `controller@verimark.edu` | `Controller@2026!` | Signatory 1 for dual approvals |
| **Academic Dean** | `dean@verimark.edu` | `Dean@2026!` | Signatory 2 for dual approvals |
| **Independent Auditor** | `auditor@verimark.edu` | `Auditor@2026!` | Read-only ledger auditor |
| **Faculty Member** | `faculty@verimark.edu` | `Faculty@2026!` | Subject evaluation views |
| **Student (Aarav Sharma)** | `aarav.sharma@student.verimark.edu` | `Act#Aarav$2026!` | Student: 88/100 Cryptography (CF2026-CSE-101) |

---

## 🧪 Comprehensive Test Coverage (193 Tests)

- `tests/crypto.test.ts` (15 tests): Canonical serialization, RFC 6962 leaf/node domain separation, Ed25519 signing.
- `tests/adversarial.test.ts` (24 tests): Token forgery, expired tokens, self-approval bypasses, private key leak prevention.
- `tests/priority_remediation.test.ts` (12 tests): Backdoor hardening, audit endpoint authorization, WORM claim compliance.
- `tests/security_remediation.test.ts` (20 tests): Server-side RBAC, unauthorized mutations, token tamper detection.
- `tests/production_security_rbac.test.ts` (31 tests): Production zero-backdoor isolation, session cookie safety.
- `tests/student_portal.test.ts` (30 tests): First-login password updates, complex password policy, marksheet verification.
- `tests/student_credentials_audit.test.ts` (12 tests): Credential safety, no hardcoded secrets in client bundles.
- `tests/workflow_and_tampering.test.ts` (7 tests): End-to-end publishing, dual approvals, simulated DB tampering & rollback.
- `tests/analytics_dashboard.test.ts` (15 tests): Benchmark calculations, pass/fail aggregations, semester history.
- `tests/serverless_storage.test.ts` (4 tests): Path safety, serverless filesystem fallback resilience.
- `tests/audit_tamper_detection.test.ts` (16 tests): Deep tamper detection, hash mismatch reporting, rollback integrity.
- `tests/saas_features.test.ts` (7 tests): Multi-tenant APIs, student rosters, exam management, batch CSV import, rate limiter.

---

## 📜 License
Developed for **Code Fuzion 2026**. Open-source under MIT License.
