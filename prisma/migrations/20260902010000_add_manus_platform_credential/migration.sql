-- Add Manus as a managed global platform credential without changing existing secrets.
ALTER TYPE "PlatformCredentialProvider" ADD VALUE IF NOT EXISTS 'MANUS';
