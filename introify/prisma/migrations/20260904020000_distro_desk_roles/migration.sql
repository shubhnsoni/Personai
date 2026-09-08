-- Distro desks: invite writes Membership.role SALES | WAREHOUSE | ACCOUNTS.
-- OWNER/ADMIN already exist; those remain the admin desk.
ALTER TYPE "MembershipRole" ADD VALUE 'SALES';
ALTER TYPE "MembershipRole" ADD VALUE 'WAREHOUSE';
ALTER TYPE "MembershipRole" ADD VALUE 'ACCOUNTS';
