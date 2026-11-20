import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

let resolvedVaultDir: string | null = null;

/**
 * Resolves a safe, writable directory for the VeriMark cryptographic vault.
 * Handles serverless environments (e.g. Vercel, AWS Lambda) where /var/task is read-only.
 */
export function getVaultDir(): string {
  if (resolvedVaultDir) {
    return resolvedVaultDir;
  }

  // 1. Explicit environment variable override
  if (process.env.VERIMARK_VAULT_DIR) {
    resolvedVaultDir = process.env.VERIMARK_VAULT_DIR;
    ensureDirExists(resolvedVaultDir);
    return resolvedVaultDir;
  }

  // 2. Serverless environment detection (Vercel, AWS Lambda)
  // On serverless, process.cwd() is /var/task which is strictly read-only.
  // /tmp is the only guaranteed writable temporary directory.
  const isServerless =
    Boolean(process.env.VERCEL) ||
    Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME) ||
    process.cwd().startsWith('/var/task');

  if (isServerless) {
    resolvedVaultDir = path.join(os.tmpdir(), '.verimark_vault');
    ensureDirExists(resolvedVaultDir);
    return resolvedVaultDir;
  }

  // 3. Local development environment
  const cwdVault = path.join(process.cwd(), '.verimark_vault');
  try {
    if (!fs.existsSync(cwdVault)) {
      fs.mkdirSync(cwdVault, { recursive: true });
    }
    // Verify directory is writable
    const testFile = path.join(cwdVault, `.write_probe_${Date.now()}`);
    fs.writeFileSync(testFile, '1');
    fs.unlinkSync(testFile);
    resolvedVaultDir = cwdVault;
    return resolvedVaultDir;
  } catch {
    // If local cwd is read-only for any reason, safely fall back to os.tmpdir()
    resolvedVaultDir = path.join(os.tmpdir(), '.verimark_vault');
    ensureDirExists(resolvedVaultDir);
    return resolvedVaultDir;
  }
}

/**
 * Resets the cached vault directory (used in test suites).
 */
export function resetVaultDirForTesting(): void {
  resolvedVaultDir = null;
}

/**
 * Safely ensures a directory exists without throwing in read-only environments.
 */
export function ensureDirExists(dir: string): boolean {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return true;
  } catch (err: any) {
    // Gracefully handle read-only filesystem errors (EROFS, EPERM, ENOENT)
    return false;
  }
}

/**
 * Safely writes file with retry handling for Windows / OneDrive locks
 * and graceful fallback in read-only environments.
 */
export function safeWriteFileSync(filePath: string, data: string): boolean {
  const maxRetries = 5;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const dir = path.dirname(filePath);
      ensureDirExists(dir);
      fs.writeFileSync(filePath, data, { mode: 0o600 });
      return true;
    } catch (err: any) {
      if (i === maxRetries - 1) {
        console.warn(`[VeriMark Vault] Warning: Unable to persist to ${filePath}: ${err?.message}`);
        return false;
      }
      // Brief synchronous backoff for OneDrive/OS file locks
      const end = Date.now() + 20;
      while (Date.now() < end) {}
    }
  }
  return false;
}
