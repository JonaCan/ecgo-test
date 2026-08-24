import { describe, test, expect } from "vitest";
import { evaluateCheckIn, type Branch } from "./geofence";

const mockBranches: Branch[] = [
  { id: "B-01", name: "Kemayoran", lat: -6.1569, lng: 106.8449, radiusM: 150, active: true },
  { id: "B-02", name: "Sunter", lat: -6.142, lng: 106.872, radiusM: 200, active: true },
  { id: "B-03", name: "Cakung", lat: -6.185, lng: 106.945, radiusM: 120, active: false },
];

describe("evaluateCheckIn Tests", () => {
  test("1. Valid check-in B-01", () => {
    const res = evaluateCheckIn(
      { userId: "U1", lat: -6.157, lng: 106.845, accuracyM: 12, at: "2026-08-20T07:00:00+07:00" },
      mockBranches
    );
    expect(res).toEqual({
      status: "VALID",
      branchId: "B-01",
      branchName: "Kemayoran",
      distanceM: 16,
    });
  });

  test("2. OUT_OF_RANGE (B-03 inactive)", () => {
    const res = evaluateCheckIn(
      { userId: "U2", lat: -6.1851, lng: 106.9451, accuracyM: 10, at: "2026-08-20T07:00:00+07:00" },
      mockBranches
    );
    expect(res.status).toBe("OUT_OF_RANGE");
  });

  test("3. REJECTED / LOW_ACCURACY", () => {
    const res = evaluateCheckIn(
      { userId: "U3", lat: -6.157, lng: 106.845, accuracyM: 140, at: "2026-08-20T07:00:00+07:00" },
      mockBranches
    );
    expect(res).toEqual({ status: "REJECTED", reason: "LOW_ACCURACY" });
  });

  test("4. REJECTED / INVALID_COORDINATE (0,0)", () => {
    const res = evaluateCheckIn(
      { userId: "U4", lat: 0, lng: 0, accuracyM: 5, at: "2026-08-20T07:00:00+07:00" },
      mockBranches
    );
    expect(res).toEqual({ status: "REJECTED", reason: "INVALID_COORDINATE" });
  });

  test("5. OUT_OF_RANGE nearest B-01", () => {
    const res = evaluateCheckIn(
      { userId: "U5", lat: -6.3, lng: 106.8, accuracyM: 15, at: "2026-08-20T07:00:00+07:00" },
      mockBranches
    );
    expect(res.status).toBe("OUT_OF_RANGE");
    if (res.status === "OUT_OF_RANGE") {
      expect(res.nearestBranchId).toBe("B-01");
    }
  });

  test("6. Invalid coordinate priority over low accuracy", () => {
    const res = evaluateCheckIn(
      { userId: "U6", lat: 999, lng: 106.845, accuracyM: 200, at: "2026-08-20T07:00:00+07:00" },
      mockBranches
    );
    expect(res).toEqual({ status: "REJECTED", reason: "INVALID_COORDINATE" });
  });

  test("7. Empty active branches -> NO_BRANCH_ASSIGNED", () => {
    const res = evaluateCheckIn(
      { userId: "U7", lat: -6.157, lng: 106.845, accuracyM: 10, at: "2026-08-20T07:00:00+07:00" },
      []
    );
    expect(res).toEqual({ status: "REJECTED", reason: "NO_BRANCH_ASSIGNED" });
  });

  test("8. GPS Accuracy capping at 30m", () => {
    const res = evaluateCheckIn(
      { userId: "U8", lat: -6.157, lng: 106.845, accuracyM: 50, at: "2026-08-20T07:00:00+07:00" },
      mockBranches
    );
    expect(res.status).toBe("VALID");
  });

  test("9. Lexicographical ID tie-breaking on exact same distance", () => {
    const identicalBranches: Branch[] = [
      { id: "B-02", name: "Branch B", lat: -6.157, lng: 106.845, radiusM: 200, active: true },
      { id: "B-01", name: "Branch A", lat: -6.157, lng: 106.845, radiusM: 200, active: true },
    ];
    const res = evaluateCheckIn(
      { userId: "U9", lat: -6.157, lng: 106.845, accuracyM: 10, at: "2026-08-20T07:00:00+07:00" },
      identicalBranches
    );
    expect(res.status).toBe("VALID");
    if (res.status === "VALID") {
      expect(res.branchId).toBe("B-01");
    }
  });

  test("10. Reject NaN coordinates", () => {
    const res = evaluateCheckIn(
      { userId: "U10", lat: NaN, lng: 106.845, accuracyM: 10, at: "2026-08-20T07:00:00+07:00" },
      mockBranches
    );
    expect(res).toEqual({ status: "REJECTED", reason: "INVALID_COORDINATE" });
  });
});