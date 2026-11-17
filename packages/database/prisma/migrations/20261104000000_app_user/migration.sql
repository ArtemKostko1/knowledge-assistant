-- Approval required before application. Product identity only; no auth schema access.
CREATE TABLE "AppUser" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "AppUser_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AppUser" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "AppUser" FROM PUBLIC, anon, authenticated;
