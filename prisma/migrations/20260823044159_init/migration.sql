-- CreateTable
CREATE TABLE "cabinet" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "last_heartbeat" TIMESTAMP(3),

    CONSTRAINT "cabinet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cabinet_line" (
    "id" SERIAL NOT NULL,
    "cabinet_id" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "state" TEXT NOT NULL,
    "soc_battery" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "cabinet_line_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cabinet_code_key" ON "cabinet"("code");

-- AddForeignKey
ALTER TABLE "cabinet_line" ADD CONSTRAINT "cabinet_line_cabinet_id_fkey" FOREIGN KEY ("cabinet_id") REFERENCES "cabinet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
