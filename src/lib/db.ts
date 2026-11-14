/**
 * The Ittsui Works database (Neon Postgres, connected on Vercel as DATABASE_URL). Never print or log it.
 * Tables are created on first use, so a new database needs no manual step.
 */
import "server-only";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";

declare global {
  var ittsuiPool: Pool | undefined;
  var ittsuiSchema: Promise<void> | undefined;
}

export const hasDatabase = () => Boolean(process.env.DATABASE_URL);

function pool(): Pool {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  globalThis.ittsuiPool ??= new Pool({ connectionString: url, max: Number(process.env.DB_POOL_MAX ?? 3), idleTimeoutMillis: 10_000 });
  return globalThis.ittsuiPool;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS companies (
  id text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL,
  contact_name text NOT NULL DEFAULT '',
  email text NOT NULL UNIQUE,
  website text NOT NULL DEFAULT '',
  country text NOT NULL,
  trades text[] NOT NULL DEFAULT '{}',
  abroad boolean NOT NULL DEFAULT false,
  lang text NOT NULL DEFAULT 'en',
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'unverified',
  leads boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  terms_at timestamptz NOT NULL DEFAULT now(),
  last_offer_at timestamptz
);
CREATE TABLE IF NOT EXISTS jobs (
  id text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  company_id text NOT NULL REFERENCES companies(id),
  title text NOT NULL,
  trade text NOT NULL,
  employment text NOT NULL,
  country text NOT NULL,
  city text NOT NULL,
  pay_min numeric,
  pay_max numeric,
  pay_currency text NOT NULL DEFAULT 'USD',
  pay_unit text NOT NULL DEFAULT 'hour',
  description text NOT NULL,
  certifications text NOT NULL DEFAULT '',
  apply_url text NOT NULL DEFAULT '',
  lang text NOT NULL DEFAULT 'en',
  status text NOT NULL DEFAULT 'pending',
  published_at timestamptz,
  expires_at timestamptz,
  sponsored_until timestamptz,
  alerted boolean NOT NULL DEFAULT false,
  applications integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS jobs_live ON jobs (status, published_at DESC);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS source_id text;
CREATE UNIQUE INDEX IF NOT EXISTS jobs_source ON jobs (source, source_id);
CREATE TABLE IF NOT EXISTS applications (
  id text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  job_id text NOT NULL REFERENCES jobs(id),
  name text NOT NULL,
  email text NOT NULL,
  country text NOT NULL,
  years text NOT NULL DEFAULT '',
  certifications text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  lang text NOT NULL DEFAULT 'en',
  UNIQUE (job_id, email)
);
CREATE TABLE IF NOT EXISTS alerts (
  id text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  email text NOT NULL,
  trade text NOT NULL,
  country text NOT NULL,
  lang text NOT NULL DEFAULT 'en',
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'unverified',
  last_sent_at timestamptz,
  UNIQUE (email, trade, country)
);
CREATE TABLE IF NOT EXISTS projects (
  id text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  trade text NOT NULL,
  title text NOT NULL,
  scope text NOT NULL,
  country text NOT NULL,
  city text NOT NULL,
  budget text NOT NULL,
  start text NOT NULL,
  power text NOT NULL,
  budget_approved boolean NOT NULL,
  start_set boolean NOT NULL,
  buyer jsonb NOT NULL,
  lang text NOT NULL DEFAULT 'en',
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'unverified',
  verified_at timestamptz,
  sold integer NOT NULL DEFAULT 0,
  alerted_at timestamptz
);
CREATE TABLE IF NOT EXISTS leads (
  token text PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(id),
  company_id text NOT NULL REFERENCES companies(id),
  offered_at timestamptz NOT NULL DEFAULT now(),
  stripe_session text,
  paid_at timestamptz,
  amount integer,
  currency text,
  refunded boolean NOT NULL DEFAULT false,
  UNIQUE (project_id, company_id)
);
CREATE TABLE IF NOT EXISTS sponsorships (
  stripe_session text PRIMARY KEY,
  job_id text NOT NULL REFERENCES jobs(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  amount integer,
  currency text
);
CREATE TABLE IF NOT EXISTS prospects (
  id text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL,
  company text NOT NULL DEFAULT '',
  website text NOT NULL DEFAULT '',
  domain text NOT NULL UNIQUE,
  email text,
  country text NOT NULL,
  trade text NOT NULL,
  lang text NOT NULL DEFAULT 'en',
  status text NOT NULL DEFAULT 'new',
  step integer NOT NULL DEFAULT 0,
  next_at timestamptz,
  last_sent_at timestamptz,
  note text NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS prospects_due ON prospects (status, next_at);
CREATE TABLE IF NOT EXISTS suppression (
  email text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  reason text NOT NULL
);
CREATE TABLE IF NOT EXISTS state (
  key text PRIMARY KEY,
  value jsonb NOT NULL
);
`;

function ensureSchema(): Promise<void> {
  globalThis.ittsuiSchema ??= pool()
    .query(SCHEMA)
    .then(() => undefined)
    .catch((error) => {
      globalThis.ittsuiSchema = undefined;
      throw error;
    });
  return globalThis.ittsuiSchema;
}

/** One parameterised query ($1, $2...). Never build SQL from user text. */
export async function query<T extends Record<string, unknown> = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  await ensureSchema();
  return (await pool().query(text, params)).rows as T[];
}

export const newToken = (bytes = 18) => randomBytes(bytes).toString("base64url");
export const newId = () => randomBytes(6).toString("base64url").replace(/[-_]/g, "x").toLowerCase();
export const isToken = (value: string) => /^[\w-]{20,40}$/.test(value);

/** A small key/value store for the daily run (outreach start date, source cursors). */
export async function getState<T>(key: string): Promise<T | null> {
  const [row] = await query<{ value: T }>(`SELECT value FROM state WHERE key = $1`, [key]);
  return row?.value ?? null;
}
export async function setState(key: string, value: unknown): Promise<void> {
  await query(`INSERT INTO state (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2`, [key, JSON.stringify(value)]);
}
