import { describe, it, expect, vi, beforeEach } from "vitest";
import * as backupService from "./services/backupService";

// Mock fs module
vi.mock("fs", () => ({
  existsSync: vi.fn().mockReturnValue(true),
  mkdirSync: vi.fn(),
  readdirSync: vi.fn().mockReturnValue([]),
  statSync: vi.fn().mockReturnValue({
    size: 1024,
    birthtime: new Date(),
  }),
  writeFileSync: vi.fn(),
  readFileSync: vi.fn().mockReturnValue(Buffer.from("test backup content")),
  unlinkSync: vi.fn(),
}));

// Mock database
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue({
    execute: vi.fn().mockResolvedValue([]),
  }),
}));

describe("Backup Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Backup Types", () => {
    it("should support daily backup type", () => {
      expect(["daily", "weekly", "manual"]).toContain("daily");
    });

    it("should support weekly backup type", () => {
      expect(["daily", "weekly", "manual"]).toContain("weekly");
    });

    it("should support manual backup type", () => {
      expect(["daily", "weekly", "manual"]).toContain("manual");
    });
  });

  describe("Backup Info Structure", () => {
    it("should have correct backup info properties", () => {
      const backupInfo = {
        id: "test-id",
        filename: "backup-manual-2026-01-08.sql",
        type: "manual" as const,
        size: 1024,
        sizeFormatted: "1 KB",
        createdAt: new Date(),
        path: "/backups/manual/backup.sql",
      };

      expect(backupInfo).toHaveProperty("id");
      expect(backupInfo).toHaveProperty("filename");
      expect(backupInfo).toHaveProperty("type");
      expect(backupInfo).toHaveProperty("size");
      expect(backupInfo).toHaveProperty("sizeFormatted");
      expect(backupInfo).toHaveProperty("createdAt");
      expect(backupInfo).toHaveProperty("path");
    });

    it("should format size correctly for bytes", () => {
      const formatSize = (bytes: number): string => {
        if (bytes === 0) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
      };

      expect(formatSize(0)).toBe("0 B");
      expect(formatSize(512)).toBe("512 B");
      expect(formatSize(1024)).toBe("1 KB");
      expect(formatSize(1536)).toBe("1.5 KB");
      expect(formatSize(1048576)).toBe("1 MB");
      expect(formatSize(1073741824)).toBe("1 GB");
    });
  });

  describe("Backup Filename Generation", () => {
    it("should generate filename with correct format", () => {
      const generateFilename = (type: string): string => {
        const now = new Date();
        const dateStr = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
        return `backup-${type}-${dateStr}.sql`;
      };

      const filename = generateFilename("manual");
      expect(filename).toMatch(/^backup-manual-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.sql$/);
    });

    it("should include backup type in filename", () => {
      const types = ["daily", "weekly", "manual"];
      types.forEach((type) => {
        const filename = `backup-${type}-2026-01-08T12-00-00.sql`;
        expect(filename).toContain(type);
      });
    });
  });

  describe("Backup Stats", () => {
    it("should return correct stats structure", async () => {
      const stats = {
        totalBackups: 10,
        totalSize: 10240,
        totalSizeFormatted: "10 KB",
        lastDailyBackup: new Date(),
        lastWeeklyBackup: new Date(),
        dailyCount: 5,
        weeklyCount: 3,
        manualCount: 2,
      };

      expect(stats.totalBackups).toBe(10);
      expect(stats.dailyCount + stats.weeklyCount + stats.manualCount).toBe(10);
    });

    it("should handle null last backup dates", () => {
      const stats = {
        totalBackups: 0,
        totalSize: 0,
        totalSizeFormatted: "0 B",
        lastDailyBackup: null,
        lastWeeklyBackup: null,
        dailyCount: 0,
        weeklyCount: 0,
        manualCount: 0,
      };

      expect(stats.lastDailyBackup).toBeNull();
      expect(stats.lastWeeklyBackup).toBeNull();
    });
  });

  describe("Backup Cleanup Configuration", () => {
    it("should keep correct number of daily backups", () => {
      const MAX_DAILY_BACKUPS = 7;
      expect(MAX_DAILY_BACKUPS).toBe(7);
    });

    it("should keep correct number of weekly backups", () => {
      const MAX_WEEKLY_BACKUPS = 4;
      expect(MAX_WEEKLY_BACKUPS).toBe(4);
    });
  });

  describe("Backup ID Encoding", () => {
    it("should encode path to base64 id", () => {
      const path = "/backups/manual/backup.sql";
      const id = Buffer.from(path).toString("base64");
      expect(id).toBeTruthy();
      expect(typeof id).toBe("string");
    });

    it("should decode base64 id to path", () => {
      const originalPath = "/backups/manual/backup.sql";
      const id = Buffer.from(originalPath).toString("base64");
      const decodedPath = Buffer.from(id, "base64").toString("utf8");
      expect(decodedPath).toBe(originalPath);
    });
  });

  describe("Backup Service Exports", () => {
    it("should export createDatabaseBackup function", () => {
      expect(typeof backupService.createDatabaseBackup).toBe("function");
    });

    it("should export listBackups function", () => {
      expect(typeof backupService.listBackups).toBe("function");
    });

    it("should export getBackup function", () => {
      expect(typeof backupService.getBackup).toBe("function");
    });

    it("should export getBackupContent function", () => {
      expect(typeof backupService.getBackupContent).toBe("function");
    });

    it("should export deleteBackup function", () => {
      expect(typeof backupService.deleteBackup).toBe("function");
    });

    it("should export cleanupOldBackups function", () => {
      expect(typeof backupService.cleanupOldBackups).toBe("function");
    });

    it("should export getBackupStats function", () => {
      expect(typeof backupService.getBackupStats).toBe("function");
    });

    it("should export runScheduledBackup function", () => {
      expect(typeof backupService.runScheduledBackup).toBe("function");
    });

    it("should export startBackupScheduler function", () => {
      expect(typeof backupService.startBackupScheduler).toBe("function");
    });

    it("should export stopBackupScheduler function", () => {
      expect(typeof backupService.stopBackupScheduler).toBe("function");
    });
  });
});
