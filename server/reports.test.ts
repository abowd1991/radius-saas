import { describe, it, expect, vi, beforeEach } from "vitest";
import * as reportsService from "./services/reportsService";
import * as reportExporter from "./services/reportExporter";

// Mock the database
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue({
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  }),
}));

describe("Reports Service", () => {
  describe("formatDuration", () => {
    it("should format seconds correctly", () => {
      expect(reportsService.formatDuration(30)).toBe("30ث");
      expect(reportsService.formatDuration(90)).toBe("1د 30ث");
      expect(reportsService.formatDuration(3661)).toBe("1س 1د");
      expect(reportsService.formatDuration(7200)).toBe("2س 0د");
    });

    it("should handle zero seconds", () => {
      expect(reportsService.formatDuration(0)).toBe("0ث");
    });
  });

  describe("formatBytes", () => {
    it("should format bytes correctly", () => {
      expect(reportsService.formatBytes(0)).toBe("0 B");
      expect(reportsService.formatBytes(1024)).toBe("1 KB");
      expect(reportsService.formatBytes(1048576)).toBe("1 MB");
      expect(reportsService.formatBytes(1073741824)).toBe("1 GB");
    });

    it("should handle decimal values", () => {
      expect(reportsService.formatBytes(1536)).toBe("1.5 KB");
    });
  });
});

describe("Report Exporter", () => {
  describe("Excel Export", () => {
    const mockRevenueData: reportsService.RevenueReport = {
      totalRevenue: 1000,
      totalTransactions: 50,
      averageTransaction: 20,
      revenueByPeriod: [
        { date: "2024-01-01", revenue: 500, transactions: 25 },
        { date: "2024-01-02", revenue: 500, transactions: 25 },
      ],
      revenueByClient: [
        { clientId: 1, clientName: "Client 1", revenue: 600 },
        { clientId: 2, clientName: "Client 2", revenue: 400 },
      ],
    };

    it("should generate revenue Excel buffer", () => {
      const buffer = reportExporter.generateRevenueExcel(mockRevenueData);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    const mockSubscribersData: reportsService.SubscribersReport = {
      totalSubscribers: 100,
      activeSubscribers: 80,
      expiredSubscribers: 15,
      suspendedSubscribers: 5,
      newSubscribersThisPeriod: 10,
      subscriberGrowth: [
        { date: "2024-01-01", count: 5 },
        { date: "2024-01-02", count: 5 },
      ],
    };

    it("should generate subscribers Excel buffer", () => {
      const buffer = reportExporter.generateSubscribersExcel(mockSubscribersData);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    const mockCardsData: reportsService.CardsReport = {
      totalCards: 500,
      unusedCards: 200,
      activeCards: 150,
      usedCards: 100,
      expiredCards: 50,
      bestSellingPlans: [
        { planId: 1, planName: "Plan A", count: 100, revenue: 1000 },
        { planId: 2, planName: "Plan B", count: 80, revenue: 800 },
      ],
      cardsByStatus: [
        { status: "unused", count: 200 },
        { status: "active", count: 150 },
      ],
      timeConsumptionByCard: [
        { cardId: 1, username: "user1", totalTime: 3600, planName: "Plan A" },
        { cardId: 2, username: "user2", totalTime: 7200, planName: "Plan B" },
      ],
    };

    it("should generate cards Excel buffer", () => {
      const buffer = reportExporter.generateCardsExcel(mockCardsData);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    const mockSessionsData: reportsService.SessionsReport = {
      totalSessions: 1000,
      activeSessions: 50,
      completedSessions: 950,
      averageSessionDuration: 1800,
      totalSessionTime: 1800000,
      sessionsByDay: [
        { date: "2024-01-01", count: 500, duration: 900000 },
        { date: "2024-01-02", count: 500, duration: 900000 },
      ],
      sessionsByNas: [
        { nasIp: "192.168.1.1", nasName: "NAS 1", count: 600 },
        { nasIp: "192.168.1.2", nasName: "NAS 2", count: 400 },
      ],
    };

    it("should generate sessions Excel buffer", () => {
      const buffer = reportExporter.generateSessionsExcel(mockSessionsData);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });
  });

  describe("PDF Export", () => {
    const mockRevenueData: reportsService.RevenueReport = {
      totalRevenue: 1000,
      totalTransactions: 50,
      averageTransaction: 20,
      revenueByPeriod: [
        { date: "2024-01-01", revenue: 500, transactions: 25 },
      ],
      revenueByClient: [
        { clientId: 1, clientName: "Client 1", revenue: 600 },
      ],
    };

    it("should generate revenue PDF HTML", () => {
      const html = reportExporter.generateRevenuePDFHTML(mockRevenueData, "2024-01-01 - 2024-01-31");
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("تقرير الإيرادات");
      expect(html).toContain("$1000.00");
      expect(html).toContain("Client 1");
    });

    const mockCardsData: reportsService.CardsReport = {
      totalCards: 500,
      unusedCards: 200,
      activeCards: 150,
      usedCards: 100,
      expiredCards: 50,
      bestSellingPlans: [
        { planId: 1, planName: "Plan A", count: 100, revenue: 1000 },
      ],
      cardsByStatus: [
        { status: "unused", count: 200 },
      ],
      timeConsumptionByCard: [
        { cardId: 1, username: "user1", totalTime: 3600, planName: "Plan A" },
      ],
    };

    it("should generate cards PDF HTML", () => {
      const html = reportExporter.generateCardsPDFHTML(mockCardsData, "2024-01-01 - 2024-01-31");
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("تقرير الكروت");
      expect(html).toContain("500");
      expect(html).toContain("Plan A");
    });

    const mockSessionsData: reportsService.SessionsReport = {
      totalSessions: 1000,
      activeSessions: 50,
      completedSessions: 950,
      averageSessionDuration: 1800,
      totalSessionTime: 1800000,
      sessionsByDay: [
        { date: "2024-01-01", count: 500, duration: 900000 },
      ],
      sessionsByNas: [
        { nasIp: "192.168.1.1", nasName: "NAS 1", count: 600 },
      ],
    };

    it("should generate sessions PDF HTML", () => {
      const html = reportExporter.generateSessionsPDFHTML(mockSessionsData, "2024-01-01 - 2024-01-31");
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("تقرير الجلسات");
      expect(html).toContain("1000");
      expect(html).toContain("NAS 1");
    });
  });

  describe("PDF HTML Structure", () => {
    it("should generate valid HTML with RTL support", () => {
      const html = reportExporter.generateReportPDFHTML(
        "Test Report",
        "2024-01-01 - 2024-01-31",
        [{ title: "Section 1", content: "<p>Test content</p>" }]
      );
      
      expect(html).toContain('dir="rtl"');
      expect(html).toContain('lang="ar"');
      expect(html).toContain("Test Report");
      expect(html).toContain("Section 1");
      expect(html).toContain("Test content");
    });

    it("should include Cairo font for Arabic support", () => {
      const html = reportExporter.generateReportPDFHTML(
        "Test",
        "2024",
        []
      );
      expect(html).toContain("Cairo");
    });
  });
});
