import { NextResponse } from 'next/server';
import { verifyResultCryptographically } from '@/lib/audit/publicVerifier';
import { getPublicKeys } from '@/lib/server/keys';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const verification = await verifyResultCryptographically(id);
    const publicKeys = getPublicKeys();

    // Sanitize result to expose only minimum necessary public verification fields
    let sanitizedResult = undefined;
    if (verification.result) {
      sanitizedResult = {
        id: verification.result.id,
        studentRegNo: verification.result.studentRegNo,
        studentName: verification.result.studentName,
        course: verification.result.course,
        subject: verification.result.subject,
        examName: verification.result.examName,
        marksObtained: verification.result.marksObtained,
        maxMarks: verification.result.maxMarks,
        publicationDate: verification.result.publicationDate,
        recordHash: verification.result.recordHash,
        status: verification.result.status,
      };
    }

    return NextResponse.json({
      success: true,
      verification: {
        status: verification.status,
        message: verification.message,
        result: sanitizedResult,
        recalculatedHash: verification.recalculatedHash,
        expectedHash: verification.expectedHash,
        isHashValid: verification.isHashValid,
        merkleProof: verification.merkleProof,
        isMerkleProofValid: verification.isMerkleProofValid,
        checkpoint: verification.checkpoint
          ? {
              sequenceNumber: verification.checkpoint.sequenceNumber,
              merkleRoot: verification.checkpoint.merkleRoot,
              checkpointHash: verification.checkpoint.checkpointHash,
              signature: verification.checkpoint.signature,
              signerPublicKey: verification.checkpoint.signerPublicKey,
              committedAt: verification.checkpoint.committedAt,
            }
          : undefined,
        isCheckpointSignatureValid: verification.isCheckpointSignatureValid,
        timestamp: verification.timestamp,
      },
      publicKeys,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
