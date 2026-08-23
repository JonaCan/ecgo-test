-- CreateTable
CREATE TABLE "swap_transaction" (
    "id" UUID NOT NULL,
    "cabinet_id" INTEGER NOT NULL,
    "cabinet_line_id" INTEGER NOT NULL,
    "swap_type" TEXT NOT NULL DEFAULT 'OUT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "swap_transaction_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "swap_transaction" ADD CONSTRAINT "swap_transaction_cabinet_id_fkey" FOREIGN KEY ("cabinet_id") REFERENCES "cabinet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "swap_transaction" ADD CONSTRAINT "swap_transaction_cabinet_line_id_fkey" FOREIGN KEY ("cabinet_line_id") REFERENCES "cabinet_line"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
