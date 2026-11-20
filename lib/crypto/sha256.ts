import { createHash } from 'crypto';
import { CanonicalResultPayload } from '../types';

/**
 * Deterministically sorts object keys and serializes to a canonical JSON string.
 * This guarantees that two identical logical records produce the exact same byte sequence.
 */
export function canonicalizeJson(obj: any): string {
  if (obj === null || obj === undefined) {
    return 'null';
  }
  if (typeof obj === 'number') {
    return Number.isFinite(obj) ? obj.toString() : 'null';
  }
  if (typeof obj === 'boolean') {
    return obj ? 'true' : 'false';
  }
  if (typeof obj === 'string') {
    return JSON.stringify(obj.trim());
  }
  if (Array.isArray(obj)) {
    const elements = obj.map((item) => canonicalizeJson(item));
    return `[${elements.join(',')}]`;
  }
  if (typeof obj === 'object') {
    const sortedKeys = Object.keys(obj).sort();
    const keyValues = sortedKeys.map((key) => {
      const val = obj[key];
      return `${JSON.stringify(key)}:${canonicalizeJson(val)}`;
    });
    return `{${keyValues.join(',')}}`;
  }
  return JSON.stringify(obj);
}

/**
 * Normalizes student result fields into a canonical result payload.
 */
export function createCanonicalResultPayload(data: {
  studentRegNo: string;
  studentName: string;
  course: string;
  subject: string;
  examName: string;
  marksObtained: number | string;
  maxMarks?: number | string;
  publicationDate: string;
}): CanonicalResultPayload {
  const marksNum = Number(data.marksObtained);
  const maxMarksNum = Number(data.maxMarks ?? 100);

  return {
    course: (data.course || '').trim(),
    exam_name: (data.examName || '').trim(),
    marks_obtained: marksNum.toFixed(2),
    max_marks: maxMarksNum.toFixed(2),
    publication_date: new Date(data.publicationDate).toISOString(),
    student_name: (data.studentName || '').trim(),
    student_reg_no: (data.studentRegNo || '').trim(),
    subject: (data.subject || '').trim(),
  };
}

/**
 * Computes standard SHA-256 hash of a string or buffer.
 */
export function sha256(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Computes deterministic SHA-256 record hash for student result payload.
 */
export function computeResultRecordHash(data: {
  studentRegNo: string;
  studentName: string;
  course: string;
  subject: string;
  examName: string;
  marksObtained: number | string;
  maxMarks?: number | string;
  publicationDate: string;
}): { canonicalJson: string; recordHash: string } {
  const canonicalPayload = createCanonicalResultPayload(data);
  const canonicalJson = canonicalizeJson(canonicalPayload);
  const recordHash = sha256(canonicalJson);
  return { canonicalJson, recordHash };
}

/**
 * Domain-separated leaf hash according to RFC 6962 / cryptographic standards:
 * MTH({d}) = SHA-256(0x00 || d)
 * Prevents second-preimage collision attacks between leaves and internal nodes.
 */
export function hashLeaf(dataHexOrBuffer: string | Buffer): string {
  const buf = typeof dataHexOrBuffer === 'string'
    ? (dataHexOrBuffer.length === 64 ? Buffer.from(dataHexOrBuffer, 'hex') : Buffer.from(dataHexOrBuffer, 'utf8'))
    : dataHexOrBuffer;
  const prefix = Buffer.from([0x00]);
  return createHash('sha256').update(Buffer.concat([prefix, buf])).digest('hex');
}

/**
 * Domain-separated internal node hash according to RFC 6962:
 * MTH({d1, d2}) = SHA-256(0x01 || leftChildHash || rightChildHash)
 */
export function hashInternalNode(leftHex: string, rightHex: string): string {
  const prefix = Buffer.from([0x01]);
  const leftBuf = Buffer.from(leftHex, 'hex');
  const rightBuf = Buffer.from(rightHex, 'hex');
  return createHash('sha256').update(Buffer.concat([prefix, leftBuf, rightBuf])).digest('hex');
}
