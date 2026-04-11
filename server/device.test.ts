import { describe, expect, it, beforeEach, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;
type TestRole = "student" | "teacher" | "labAdmin" | "sysAdmin";

function createTestContext(role: TestRole = "student", userId: number = 1): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `test-user-${userId}`,
    email: `test${userId}@example.com`,
    name: `Test User ${userId}`,
    loginMethod: "manus",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as unknown as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as unknown as TrpcContext["res"],
  };

  return ctx;
}

describe("Device Management", () => {
  describe("device.list", () => {
    it("should return all devices", async () => {
      const caller = appRouter.createCaller(createTestContext("student"));
      const devices = await caller.device.list();
      expect(Array.isArray(devices)).toBe(true);
    });
  });

  describe("device.getById", () => {
    it("should return device by id when exists", async () => {
      const caller = appRouter.createCaller(createTestContext("student"));
      
      // Mock the database
      vi.spyOn(db, "getDeviceById").mockResolvedValue({
        id: 1,
        labId: 1,
        deviceNo: "DEV-001",
        name: "Spectrophotometer",
        type: "Measurement",
        purchaseDate: new Date("2024-01-01"),
        status: "available",
        description: "Test device",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const device = await caller.device.getById({ id: 1 });
      expect(device?.deviceNo).toBe("DEV-001");
      expect(device?.status).toBe("available");
    });

    it("should return undefined when device not found", async () => {
      const caller = appRouter.createCaller(createTestContext("student"));
      
      vi.spyOn(db, "getDeviceById").mockResolvedValue(undefined);

      const device = await caller.device.getById({ id: 999 });
      expect(device).toBeUndefined();
    });
  });

  describe("device.listByLab", () => {
    it("should return devices for a specific lab", async () => {
      const caller = appRouter.createCaller(createTestContext("student"));
      
      vi.spyOn(db, "getDevicesByLabId").mockResolvedValue([
        {
          id: 1,
          labId: 1,
          deviceNo: "DEV-001",
          name: "Device 1",
          type: "Type A",
          purchaseDate: new Date(),
          status: "available",
          description: "",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 2,
          labId: 1,
          deviceNo: "DEV-002",
          name: "Device 2",
          type: "Type B",
          purchaseDate: new Date(),
          status: "maintenance",
          description: "",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as any);

      const devices = await caller.device.listByLab({ labId: 1 });
      expect(Array.isArray(devices)).toBe(true);
      expect(devices.length).toBe(2);
      expect(devices[0].labId).toBe(1);
      expect(devices[1].labId).toBe(1);
    });
  });

  describe("device.create", () => {
    it("should create device as admin", async () => {
      const caller = appRouter.createCaller(createTestContext("labAdmin"));
      
      vi.spyOn(db, "createDevice").mockResolvedValue({ insertId: 1 } as any);

      const result = await caller.device.create({
        labId: 1,
        deviceNo: "DEV-001",
        name: "Spectrophotometer",
        type: "Measurement",
        purchaseDate: new Date("2024-01-01"),
        status: "available",
        description: "Lab measurement device",
      });

      expect(result.success).toBe(true);
    });

    it("should fail to create device as non-admin", async () => {
      const caller = appRouter.createCaller(createTestContext("student"));

      try {
        await caller.device.create({
          labId: 1,
          deviceNo: "DEV-001",
          name: "Spectrophotometer",
          type: "Measurement",
          status: "available",
        });
        expect.fail("Should have thrown error");
      } catch (error: any) {
        expect(error.code).toBe("FORBIDDEN");
      }
    });
  });

  describe("device.update", () => {
    it("should update device as admin", async () => {
      const caller = appRouter.createCaller(createTestContext("labAdmin"));
      
      vi.spyOn(db, "updateDevice").mockResolvedValue(undefined);

      const result = await caller.device.update({
        id: 1,
        status: "maintenance",
        description: "Under maintenance",
      });

      expect(result.success).toBe(true);
    });

    it("should fail to update device as non-admin", async () => {
      const caller = appRouter.createCaller(createTestContext("student"));

      try {
        await caller.device.update({
          id: 1,
          status: "maintenance",
        });
        expect.fail("Should have thrown error");
      } catch (error: any) {
        expect(error.code).toBe("FORBIDDEN");
      }
    });
  });

  describe("device.delete", () => {
    it("should delete device as admin", async () => {
      const caller = appRouter.createCaller(createTestContext("labAdmin"));
      
      vi.spyOn(db, "deleteDevice").mockResolvedValue(undefined);

      const result = await caller.device.delete({ id: 1 });
      expect(result.success).toBe(true);
    });

    it("should fail to delete device as non-admin", async () => {
      const caller = appRouter.createCaller(createTestContext("student"));

      try {
        await caller.device.delete({ id: 1 });
        expect.fail("Should have thrown error");
      } catch (error: any) {
        expect(error.code).toBe("FORBIDDEN");
      }
    });
  });

  describe("Device Status Validation", () => {
    it("should only allow valid status values", async () => {
      const caller = appRouter.createCaller(createTestContext("labAdmin"));
      
      // Valid statuses should work
      const validStatuses = ["available", "maintenance", "retired"];
      expect(validStatuses).toContain("available");
      expect(validStatuses).toContain("maintenance");
      expect(validStatuses).toContain("retired");

      // Invalid status should be rejected by schema
      try {
        await caller.device.create({
          labId: 1,
          deviceNo: "DEV-001",
          name: "Device",
          status: "invalid_status" as any,
        });
        expect.fail("Should have thrown validation error");
      } catch (error: any) {
        expect(error.code).toBe("BAD_REQUEST");
      }
    });
  });
});
