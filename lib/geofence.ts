export type Branch = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radiusM: number;
  active: boolean;
};

export type CheckIn = {
  userId: string;
  lat: number;
  lng: number;
  accuracyM: number;
  at: string;
};

export type RejectReason =
  | "NO_BRANCH_ASSIGNED"
  | "LOW_ACCURACY"
  | "INVALID_COORDINATE";

export type Result =
  | { status: "VALID"; branchId: string; branchName: string; distanceM: number }
  | { status: "OUT_OF_RANGE"; nearestBranchId: string | null; distanceM: number | null }
  | { status: "REJECTED"; reason: RejectReason };

function calculateHaversineDistanceM(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const EARTH_RADIUS_M = 6371008.8;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const radLat1 = toRad(lat1);
  const radLat2 = toRad(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(radLat1) *
      Math.cos(radLat2) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_M * c);
}

export function evaluateCheckIn(checkIn: CheckIn, branches: Branch[]): Result {
  const isLatInvalid = Number.isNaN(checkIn.lat) || checkIn.lat < -90 || checkIn.lat > 90;
  const isLngInvalid = Number.isNaN(checkIn.lng) || checkIn.lng < -180 || checkIn.lng > 180;
  const isZeroPoint = checkIn.lat === 0 && checkIn.lng === 0;

  if (isLatInvalid || isLngInvalid || isZeroPoint) {
    return { status: "REJECTED", reason: "INVALID_COORDINATE" };
  }

  if (checkIn.accuracyM > 100 || Number.isNaN(checkIn.accuracyM)) {
    return { status: "REJECTED", reason: "LOW_ACCURACY" };
  }

  const activeBranches = branches.filter((b) => b.active);
  if (activeBranches.length === 0) {
    return { status: "REJECTED", reason: "NO_BRANCH_ASSIGNED" };
  }

  const candidates = activeBranches.map((branch) => {
    const distanceM = calculateHaversineDistanceM(
      checkIn.lat,
      checkIn.lng,
      branch.lat,
      branch.lng
    );
    const allowedRadiusM = branch.radiusM + Math.min(checkIn.accuracyM, 30);
    return { branch, distanceM, allowedRadiusM, isValid: distanceM <= allowedRadiusM };
  });

  const validCandidates = candidates.filter((c) => c.isValid);

  if (validCandidates.length > 0) {
    validCandidates.sort((a, b) => {
      if (a.distanceM !== b.distanceM) return a.distanceM - b.distanceM;
      return a.branch.id.localeCompare(b.branch.id);
    });

    const best = validCandidates[0];
    return {
      status: "VALID",
      branchId: best.branch.id,
      branchName: best.branch.name,
      distanceM: best.distanceM,
    };
  }

  candidates.sort((a, b) => {
    if (a.distanceM !== b.distanceM) return a.distanceM - b.distanceM;
    return a.branch.id.localeCompare(b.branch.id);
  });

  const nearest = candidates[0];
  return {
    status: "OUT_OF_RANGE",
    nearestBranchId: nearest ? nearest.branch.id : null,
    distanceM: nearest ? nearest.distanceM : null,
  };
}