# VERIMARK — DATA PRESERVATION AND MIGRATION PLAN (H8)

**Project**: VeriMark – Tamper-Proof Academic Result Ledger  
**Problem Statement**: H8 (Code Fuzion 2026)  
**Date**: November 20, 2026 | 22:35 IST  
**Directive**: **STRICT ZERO-DATA-LOSS & DEMONSTRATION CONTINUITY MANDATE**  
**Status**: **Verified Baseline Captured — Awaiting User Approval Before Execution**

---

## 1. Executive Summary & Strict Zero-Data-Loss Mandate

Per explicit user instruction, the populated VeriMark environment is our live **hackathon evaluation environment**. Judges and evaluators will directly interact with and audit the five existing student marksheet records, historical append-only event blocks, RFC 6962 Merkle tree roots, signed checkpoints, and institutional keyrings.

### Non-Negotiable Operational Principles:
1. **NO Database Wipes or Re-seeding**: The database will never be emptied, reset to an initial state, or re-seeded with altered IDs.
2. **NO Cryptographic Invalidation**: Historical record hashes, event hashes, Merkle roots, and Ed25519 digital signatures must remain 100% valid.
3. **NO Removal of Core Demonstrations**: All 9 interactive judge evaluations (direct SQL tampering, deep audit detection, vault rollback, dual-approval workflow, and public QR verification) must remain live and populated.
4. **NO Blind Automation**: All migrations will be non-destructive, non-blocking, and validated against baseline backups before activation.

---

## 2. Verified Baseline Inventory & Backup Registry

A complete snapshot of the active vault was captured and verified in `.verimark_vault/backups/baseline_demo_hackathon/`.

### Verified File Checksums
| File | Storage Path | SHA-256 Integrity Hash | Status |
|---|---|---|:---:|
| **Primary Database** | `.verimark_vault/database.json` | `CE9685E4ADC7E558F69AF983830A03485587B37EFD760588406600BE04B31231` | **VERIFIED** |
| **Local Checkpoint Store** | `.verimark_vault/independent_checkpoints.json` | `ED50F0213B7F81EFEEBDB990BA3009953FA3ADFDF8F7B6963C72F37FBBFA63BF` | **VERIFIED** |
| **Institutional Keystore** | `.verimark_vault/keystore.json` | `A44F7B5A0B52F7E54ADCCE910A53480BD4251A0F1017CBB8EEF700215CCE4990` | **VERIFIED** |

---

### Baseline Record Details (Preserved for Judges)

#### A. Preserved Student Marksheet Records (5 Records)
All 5 records are in `published` status and sealed under Checkpoint #5:

1. **Aarav Sharma** (`CF2026-CSE-101`)
   - Record ID: `res_1795194047171_bvke0`
   - Course: B.Tech Computer Science & Engineering
   - Subject: Cryptography & Network Security
   - Marks: **88.00 / 100**
   - Canonical SHA-256 Record Hash: `2df321ced340a17e191b5a8486e6502281f0565a0d872172abfb445bf418b1e9`
   - Leaf Index: `0` | Leaf Hash: `ee268483ae9817bf3fd229e5892578de9e33134e371fbc96ae290aae43144053`
2. **Bhavna Reddy** (`CF2026-CSE-102`)
   - Record ID: `res_1795194047178_bzufe`
   - Course: B.Tech Computer Science & Engineering
   - Subject: Distributed Ledger Technologies
   - Marks: **94.00 / 100**
   - Canonical SHA-256 Record Hash: `83b02f3bc8d33b9b90ead8f342ba901314f7f15062ddd8f59e286e7a97b0b256`
   - Leaf Index: `1` | Leaf Hash: `fe4e9ef688233f786406c39631501b9c1b748620d377c568a5df14e5b1573dab`
3. **Chetan Verma** (`CF2026-CSE-103`)
   - Record ID: `res_1795194047187_v6p0g`
   - Course: B.Tech Computer Science & Engineering
   - Subject: Database Systems Architecture
   - Marks: **76.00 / 100**
   - Canonical SHA-256 Record Hash: `1f1f650eb7e1df0c59015dc04d6d40fd841e305105779e706403321a5afd6e0a`
   - Leaf Index: `2` | Leaf Hash: `1277a69130ff4f49ac52ae94c9c64ba66360c08ee0eaea121bfbdef53335b040`
4. **Divya Nair** (`CF2026-CSE-104`)
   - Record ID: `res_1795194047193_ka4qo`
   - Course: B.Tech Computer Science & Engineering
   - Subject: Operating Systems & Security
   - Marks: **91.00 / 100**
   - Canonical SHA-256 Record Hash: `cd86b9707540833813c36d35f6c3d699aacd203f771fc4583a0bdb94d536d692`
   - Leaf Index: `3` | Leaf Hash: `44184da1d9a1170908cd4f74ecb70128ec97db0a4328d79dbc7787942920b96f`
5. **Eshan Roy** (`CF2026-CSE-105`)
   - Record ID: `res_1795194047198_ha0a8`
   - Course: B.Tech Computer Science & Engineering
   - Subject: Algorithm Design & Analysis
   - Marks: **83.00 / 100**
   - Canonical SHA-256 Record Hash: `3734f4ff96e889c79d2d5893cfd49ecf623d8f19134e390a57598e97742fc277`
   - Leaf Index: `4` | Leaf Hash: `425240e67b48b37719dfb2acbf93f200a3aa41f3b1703a7ecce8ad2638ca924b`

---

#### B. Preserved Append-Only Ledger Events (5 Events)
Continuous monotonic cryptographic chain:

* **Event #1** (`evt_1_16219d357b`):
  - Type: `RESULT_PUBLISHED` | Target: `CF2026-CSE-101`
  - `prevEventHash`: `0000000000000000000000000000000000000000000000000000000000000000` (Genesis)
  - `eventHash`: `16219d357bb12f51c55bc10a70e4c7bd54a682ad0b738c9387d47781a9fa5fd2`
* **Event #2** (`evt_2_5c04c84960`):
  - Type: `RESULT_PUBLISHED` | Target: `CF2026-CSE-102`
  - `prevEventHash`: `16219d357bb12f51c55bc10a70e4c7bd54a682ad0b738c9387d47781a9fa5fd2`
  - `eventHash`: `5c04c849602d57887d278776c7b762e2f8c44162eff43498818b083f4d9f5e25`
* **Event #3** (`evt_3_361f656250`):
  - Type: `RESULT_PUBLISHED` | Target: `CF2026-CSE-103`
  - `prevEventHash`: `5c04c849602d57887d278776c7b762e2f8c44162eff43498818b083f4d9f5e25`
  - `eventHash`: `361f656250407a4d719e2fb543103e6b677b1f7072b520eabe950d14b923d37e`
* **Event #4** (`evt_4_d8006b647b`):
  - Type: `RESULT_PUBLISHED` | Target: `CF2026-CSE-104`
  - `prevEventHash`: `361f656250407a4d719e2fb543103e6b677b1f7072b520eabe950d14b923d37e`
  - `eventHash`: `d8006b647b47f80d1843300543162a5fc1686dbd41c049fe8b06b56d6ffe7cb3`
* **Event #5** (`evt_5_591072d834`):
  - Type: `RESULT_PUBLISHED` | Target: `CF2026-CSE-105`
  - `prevEventHash`: `d8006b647b47f80d1843300543162a5fc1686dbd41c049fe8b06b56d6ffe7cb3`
  - `eventHash`: `591072d834bcafe44e323a6dd05fcd865f57dad0ba169404d7a515011f74aed5`

---

#### C. Preserved Checkpoints & Active Cryptographic State
* **Active Sequence Number**: **#5** (`chk_5_ce33a9e8a381`)
* **Active RFC 6962 Merkle Root**: `dd3eef27b8ac61fffd4f65e7f0514d283f89615cdbb8081cdec1d1a97dcb55bc`
* **Active Previous Checkpoint Hash**: `c41eb191e074d7b6f652bae8233b3f2e4db5a18e2a8c494dd7416d777918ad48`
* **Active Checkpoint Hash**: `ce33a9e8a3816408a6de3407218d752d7cf57516a530ec64f7c4447092470ac1`
* **Ed25519 Authority Digital Signature**:  
  `8f39f4611d00ca98c0863aeff8431c985754212a2e8eef48baf0234f64f34bf9de858596dacecf3571557379d6483d01e78e5ebf1cab122d7ff81709ae6d7f0f`
* **Central Authority Public Key**:  
  `42e9460d091b735ed7f988f789c0fbe116cb90bd49bca26bd0210cf6c65a2d6c`
* **Exam Controller (Approver 1) Public Key**:  
  `db261bdba73027da77e0fa175ed4a528469864b5f6af7b3f6745c6e7abdef4be`
* **Academic Dean (Approver 2) Public Key**:  
  `71f3adf0c87986be62030338019f33fc7273bed03de86c5a891e2bcfc49bcb6c`

---

## 3. Separation of Demonstration Data from Production Security

To achieve both enterprise-grade security and seamless hackathon evaluation:

1. **Environment-Gated Authentication**:
   - In **production** (`process.env.NODE_ENV === 'production'`), `demoRole` requests to `/api/auth/login` are strictly rejected with HTTP 403. Authenticators must supply genuine bcrypt/scrypt credentials.
   - In **development / demonstration mode** (`NODE_ENV !== 'production'`), judges can instantly switch roles using the institutional header switcher to test role-based access control without credential friction.
2. **Preservation of Pre-Configured Institutional Directory**:
   - The institutional accounts for:
     * `admin@verimark.edu` (Chief Academic Officer, `ADMIN`)
     * `controller@verimark.edu` (Dr. Robert Vance, `EXAM_CONTROLLER`)
     * `dean@verimark.edu` (Prof. Margaret Hamilton, `ACADEMIC_DEAN`)
     * `auditor@verimark.edu` (Dr. Elena Rostova, `AUDITOR`)
   - Are permanently anchored in `lib/server/auth.ts` with verified scrypt hashes. They will never be wiped or overwritten.
3. **Transparent Demonstration Context**:
   - The UI clearly indicates that the current dataset is an evaluation ledger representing Code Fuzion 2026 academic examinations, preventing confusion with real university records while maintaining cryptographic realism.

---

## 4. Non-Destructive Migration Architecture

When introducing future schema fields or transitioning to external databases (e.g. Supabase / PostgreSQL):

```
┌────────────────────────────────────────────────────────┐
│               UPGRADE SAFETY WORKFLOW                  │
├────────────────────────────────────────────────────────┤
│ 1. Snapshot Vault & Checksums (.verimark_vault/backups)│
│ 2. Schema Non-Destructive Ingestion (Schema Extenders) │
│ 3. Checkpoint & Signature Verification Pass            │
│ 4. Read-Compatibility Verification (All 5 Modules)     │
│ 5. Automated 76-Test Regression Suite Execution        │
└────────────────────────────────────────────────────────┘
```

### Key Migration Rules:
1. **Additive Schema Changes Only**: Any new fields must be optional or provide fallback defaults. Existing fields (`id`, `studentRegNo`, `studentName`, `course`, `subject`, `marksObtained`, `recordHash`, `publicationDate`) will never be deleted, renamed, or modified.
2. **Canonical Hash Preservation Contract**: The serialization order and formatting in `canonicalizeJson` must remain unchanged. If a new field is added to `StudentResult`, it must be excluded from historical hash recalculations unless explicitly versioned (`version >= 2`).
3. **Database Seeder Guard**:
   - `dbService.seedInitialData()` must strictly verify `if (db.results.length > 0) return;`.
   - Under no circumstances will the seeder purge or overwrite existing data.
4. **Independent Checkpoint Monotonicity**:
   - Any new checkpoint committed during dual-approval or result publishing will automatically link to the current latest checkpoint (`chk_5_ce33a9e8a381`) with sequence `#6`, maintaining the unbroken chain.

---

## 5. Demonstration Continuity Guarantee (All 9 Features)

The following 9 core judge demonstrations are verified to remain functional without reset:

| # | Demonstration Action | Route / Module | How Existing Data Supports It | Verification Method |
|---|---|---|---|:---:|
| **1** | View existing student marks | `/` & `/results` | Displays all 5 seeded students with marks and status. | Dynamic API fetch |
| **2** | Inspect historical ledger events | `/ledger` | Displays Events #1 through #5 with unbroken hash chaining. | Real block explorer |
| **3** | Inspect Merkle roots & signed checkpoints | `/ledger` | Displays Checkpoints #1 through #5 with real Ed25519 signatures. | Key ring verification |
| **4** | Create a correction request | `/results` | Click "Request Correction" on any student to generate request. | Server-side validation |
| **5** | Approve corrections using two distinct accounts | `/corrections` | Dr. Vance signs as Controller; Prof. Hamilton signs as Dean. | Cryptographic dual sign |
| **6** | Simulate direct database tampering | `/audit` | Mutates Aarav Sharma's marks to 99.5 in database.json directly. | Out-of-band DB mutation |
| **7** | Deep audit detection of altered record | `/audit` | Instantly flags `CRITICAL INTEGRITY BREACH` with mismatched hash. | Canonical recomputation |
| **8** | Cryptographic rollback to authentic state | `/audit` | Replays verified ledger events, matches Merkle root, restores marks. | Vault-backed rollback |
| **9** | Public QR marksheet verification | `/verify/[id]` | Scan QR to run 3-tier check (Record Hash, Merkle Proof, Checkpoint). | Client-safe crypto verifier |

---

## 6. Stop-and-Notify Triggers

If any future upgrade requirement threatens to:
- Invalidate existing Ed25519 signatures on Checkpoints #1 through #5;
- Change the alphabetical sorting of student records that would alter the Merkle root (`dd3eef...`);
- Alter the canonical JSON payload formatting of published events;
- Require clearing `database.json` or `independent_checkpoints.json`;

**Execution will immediately HALT, and a formal impact analysis will be presented for review before proceeding.**

---

**Plan Status**: Ready for review. No destructive actions will be executed without explicit authorization.
