import { router, superAdminProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, readFile, unlink } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const execAsync = promisify(exec);

// Backup directory
const BACKUP_DIR = "/home/ubuntu/backups";
const MAX_BACKUPS = 10; // Retention policy

/**
 * Create a full database backup
 */
async function createBackup(): Promise<{ filename: string; path: string; size: number }> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `radius-backup-${timestamp}.sql`;
  const backupPath = path.join(BACKUP_DIR, filename);

  // Ensure backup directory exists
  await execAsync(`mkdir -p ${BACKUP_DIR}`);

  // Get database connection details from environment
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DATABASE_URL not configured" });
  }

  // Parse connection string
  const match = dbUrl.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
  if (!match) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Invalid DATABASE_URL format" });
  }

  const [, user, password, host, port, databaseWithParams] = match;
  // Remove query parameters from database name
  const database = databaseWithParams.split('?')[0];

  // Create backup using mysqldump
  try {
    await execAsync(
      `mysqldump -h ${host} -P ${port} -u ${user} -p'${password}' ${database} > ${backupPath}`,
      { maxBuffer: 100 * 1024 * 1024 } // 100MB buffer
    );

    // Get file size
    const { stdout } = await execAsync(`stat -f%z "${backupPath}" 2>/dev/null || stat -c%s "${backupPath}"`);
    const size = parseInt(stdout.trim());

    return { filename, path: backupPath, size };
  } catch (error: any) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Backup failed: ${error.message}`,
    });
  }
}

/**
 * Restore database from backup file
 */
async function restoreBackup(backupPath: string): Promise<void> {
  if (!existsSync(backupPath)) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Backup file not found" });
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DATABASE_URL not configured" });
  }

  const match = dbUrl.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
  if (!match) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Invalid DATABASE_URL format" });
  }

  const [, user, password, host, port, databaseWithParams] = match;
  // Remove query parameters from database name
  const database = databaseWithParams.split('?')[0];

  try {
    await execAsync(
      `mysql -h ${host} -P ${port} -u ${user} -p'${password}' ${database} < ${backupPath}`,
      { maxBuffer: 100 * 1024 * 1024 }
    );
  } catch (error: any) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Restore failed: ${error.message}`,
    });
  }
}

/**
 * Apply retention policy - keep only last N backups
 */
async function applyRetentionPolicy(): Promise<void> {
  try {
    const { stdout } = await execAsync(`ls -t ${BACKUP_DIR}/radius-backup-*.sql 2>/dev/null || true`);
    const backups = stdout.trim().split('\n').filter(Boolean);

    if (backups.length > MAX_BACKUPS) {
      const toDelete = backups.slice(MAX_BACKUPS);
      for (const backup of toDelete) {
        await unlink(backup);
      }
    }
  } catch (error) {
    // Ignore errors in retention policy
    console.error("Retention policy error:", error);
  }
}

export const backupRouter = router({
  /**
   * Create a new backup (Owner only)
   */
  create: superAdminProcedure
    .mutation(async () => {
      const backup = await createBackup();
      await applyRetentionPolicy();

      return {
        success: true,
        filename: backup.filename,
        size: backup.size,
      };
    }),

  /**
   * Download backup file (Owner only)
   */
  download: superAdminProcedure
    .input(z.object({ filename: z.string() }))
    .query(async ({ input }: { input: { filename: string } }) => {
      const backupPath = path.join(BACKUP_DIR, input.filename);

      if (!existsSync(backupPath)) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Backup file not found" });
      }

      // Read file content
      const content = await readFile(backupPath, 'utf-8');

      return {
        filename: input.filename,
        content,
      };
    }),

  /**
   * Upload and restore backup (Owner only)
   */
  restore: superAdminProcedure
    .input(z.object({
      filename: z.string(),
      content: z.string(),
    }))
    .mutation(async ({ input }: { input: { filename: string; content: string } }) => {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const tempPath = path.join(BACKUP_DIR, `restore-${timestamp}.sql`);

      try {
        // Save uploaded content
        await writeFile(tempPath, input.content, 'utf-8');

        // Restore from backup
        await restoreBackup(tempPath);

        // Clean up temp file
        await unlink(tempPath);

        return { success: true };
      } catch (error: any) {
        // Clean up on error
        if (existsSync(tempPath)) {
          await unlink(tempPath);
        }
        throw error;
      }
    }),

  /**
   * List available backups (Owner only)
   */
  list: superAdminProcedure
    .query(async () => {
      try {
        const { stdout } = await execAsync(`ls -lt ${BACKUP_DIR}/radius-backup-*.sql 2>/dev/null || true`);
        const lines = stdout.trim().split('\n').filter(Boolean);

        const backups = lines.map(line => {
          const parts = line.split(/\s+/);
          const filename = parts[parts.length - 1].split('/').pop() || '';
          const size = parseInt(parts[4]) || 0;

          return {
            filename,
            size,
            createdAt: new Date(parts.slice(5, 8).join(' ')),
          };
        });

        return backups;
      } catch (error) {
        return [];
      }
    }),

  /**
   * Delete a backup file (Owner only)
   */
  delete: superAdminProcedure
    .input(z.object({ filename: z.string() }))
    .mutation(async ({ input }: { input: { filename: string } }) => {
      const backupPath = path.join(BACKUP_DIR, input.filename);

      if (!existsSync(backupPath)) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Backup file not found" });
      }

      await unlink(backupPath);

      return { success: true };
    }),
});
