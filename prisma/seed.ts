import "dotenv/config";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const user = encodeURIComponent(process.env.DB_USER || "postgres");
const password = encodeURIComponent(process.env.DB_PASSWORD || "");
const host = process.env.DB_HOST || "localhost";
const port = parseInt(process.env.DB_PORT || "5432", 10);
const dbName = process.env.DB_NAME || "mydb";
const schema = process.env.DB_SCHEMA || "public";
const connectionString = `postgresql://${user}:${password}@${host}:${port}/${dbName}?schema=${schema}`;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const CABINET_COUNT = 50;
const SLOTS_PER_CABINET = 12;
const TRANSACTION_COUNT = 20_000;
const DAYS_OF_TRANSACTIONS = 30;
const TXN_CHUNK_SIZE = 5_000;

type CabinetStatus = "ONLINE" | "OFFLINE" | "MAINTENANCE";
type LineState = "EMPTY" | "CHARGING" | "FULL" | "LOCKED" | "FAULT";

/** Picks a value according to relative weights, e.g. weightedPick([["FULL", 4], ["EMPTY", 1]]) */
function weightedPick<T>(entries: readonly (readonly [T, number])[]): T {
  const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = Math.random() * totalWeight;
  for (const [value, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return value;
  }
  return entries[entries.length - 1][0];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function minutesAgo(minutes: number): Date {
  return new Date(Date.now() - minutes * 60_000);
}

const CABINET_STATUSES: readonly (readonly [CabinetStatus, number])[] = [
  ["ONLINE", 70],
  ["OFFLINE", 18],
  ["MAINTENANCE", 12],
];

const LINE_STATES: readonly (readonly [LineState, number])[] = [
  ["FULL", 40],
  ["CHARGING", 25],
  ["EMPTY", 15],
  ["LOCKED", 12],
  ["FAULT", 8],
];

/** Battery charge consistent with the slot's state (0-100, where 100 = full). */
function socForState(state: LineState): number {
  switch (state) {
    case "EMPTY":
      return randomInt(0, 10);
    case "CHARGING":
      return randomInt(15, 90);
    case "FULL":
      return 100;
    case "LOCKED":
      return randomInt(85, 100); // reserved, fully charged battery
    case "FAULT":
      return randomInt(0, 100);
  }
}

/** ONLINE cabinets ping constantly; OFFLINE ones went silent days ago. */
function lastHeartbeatFor(status: CabinetStatus): Date {
  switch (status) {
    case "ONLINE":
      return minutesAgo(randomInt(0, 5));
    case "OFFLINE":
      return new Date(Date.now() - randomInt(1, 7) * 24 * 60 * 60_000);
    case "MAINTENANCE":
      return minutesAgo(randomInt(60, 24 * 60));
  }
}

async function main() {
  // Delete children before parents to respect foreign keys.
  console.log("Cleaning up existing data...");
  await prisma.swap_transaction.deleteMany();
  await prisma.cabinet_line.deleteMany();
  await prisma.cabinet.deleteMany();

  // --- Cabinets ---
  console.log(`Seeding ${CABINET_COUNT} cabinets...`);
  const branchCount = 10;
  await prisma.cabinet.createMany({
    data: Array.from({ length: CABINET_COUNT }, (_, i) => {
      const status = weightedPick(CABINET_STATUSES);
      return {
        code: `CAB-${String(i + 1).padStart(3, "0")}`,
        branch: `Branch-${String((i % branchCount) + 1).padStart(2, "0")}`,
        status,
        last_heartbeat: lastHeartbeatFor(status),
      };
    }),
  });

  const cabinets = await prisma.cabinet.findMany({
    select: { id: true, status: true },
  });
  const cabinetStatusById = new Map(cabinets.map((c) => [c.id, c.status]));

  // --- Cabinet lines ---
  console.log(
    `Seeding ${CABINET_COUNT * SLOTS_PER_CABINET} cabinet lines...`
  );
  await prisma.cabinet_line.createMany({
    data: cabinets.flatMap((cabinet) =>
      Array.from({ length: SLOTS_PER_CABINET }, (_, index) => {
        const state = weightedPick(LINE_STATES);
        return {
          cabinet_id: cabinet.id,
          order: index + 1,
          state,
          soc_battery: socForState(state),
        };
      })
    ),
  });

  const lines = await prisma.cabinet_line.findMany({
    select: { id: true, cabinet_id: true },
  });
  if (lines.length === 0) throw new Error("No cabinet lines found after seed");

  // Swaps only happen on reachable cabinets; fall back to all lines
  // if there are none online for some reason.
  const onlineLines = lines.filter(
    (line) => cabinetStatusById.get(line.cabinet_id) === "ONLINE"
  );
  const transactionSources =
    onlineLines.length >= SLOTS_PER_CABINET ? onlineLines : lines;

  // --- Swap transactions ---
  console.log(
    `Seeding ${TRANSACTION_COUNT} transactions across ${DAYS_OF_TRANSACTIONS} days...`
  );
  const now = Date.now();
  const windowMs = DAYS_OF_TRANSACTIONS * 24 * 60 * 60_000;

  for (
    let inserted = 0;
    inserted < TRANSACTION_COUNT;
    inserted += TXN_CHUNK_SIZE
  ) {
    const chunkSize = Math.min(TXN_CHUNK_SIZE, TRANSACTION_COUNT - inserted);
    await prisma.swap_transaction.createMany({
      data: Array.from({ length: chunkSize }, () => {
        const source =
          transactionSources[randomInt(0, transactionSources.length - 1)];
        return {
          cabinet_id: source.cabinet_id,
          cabinet_line_id: source.id,
          swap_type: weightedPick([
            ["OUT", 60],
            ["IN", 40],
          ] as const),
          created_at: new Date(now - Math.random() * windowMs),
        };
      }),
    });
    console.log(
      `  transactions: ${Math.min(inserted + chunkSize, TRANSACTION_COUNT)}/${TRANSACTION_COUNT}`
    );
  }

  const [cabinetTotal, lineTotal, txnTotal] = await Promise.all([
    prisma.cabinet.count(),
    prisma.cabinet_line.count(),
    prisma.swap_transaction.count(),
  ]);
  console.log(
    `Done. Cabinets: ${cabinetTotal}, Lines: ${lineTotal}, Transactions: ${txnTotal}`
  );
}

main()
  .catch((e) => {
    console.error("Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
