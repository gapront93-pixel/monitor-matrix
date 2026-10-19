-- Models outside the current lineup and retired segments are hidden, not deleted
ALTER TABLE "Product" ADD COLUMN "hidden" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Segment" ADD COLUMN "hidden" BOOLEAN NOT NULL DEFAULT false;
