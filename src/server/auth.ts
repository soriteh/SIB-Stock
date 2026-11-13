import { betterAuth } from 'better-auth'
import { Pool } from 'pg'

const databaseUrl = process.env.DATABASE_URL
const authSecret = process.env.BETTER_AUTH_SECRET

if (!databaseUrl) throw new Error('DATABASE_URL is required by the Better Auth server.')
if (!authSecret || authSecret.length < 32) {
  throw new Error('BETTER_AUTH_SECRET must be configured with at least 32 characters.')
}

const trustedOrigins = (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: true },
  // Keep Better Auth tables separate from existing SIB business tables.
  options: '-c search_path=better_auth',
  // Vercel serverless: keep each function instance's connection footprint small.
  max: 1,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
})

export const auth = betterAuth({
  appName: 'SIB Stock',
  database: pool,
  secret: authSecret,
  baseURL: process.env.BETTER_AUTH_URL || undefined,
  trustedOrigins,
  emailAndPassword: {
    enabled: true,
    // Keep public account creation closed until tenant onboarding and invitations are migrated.
    disableSignUp: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  rateLimit: { enabled: true, window: 60, max: 10 },
})
