import { SITE_URL } from "@/lib/site";

/** A plain summary for AI assistants and answer engines (llmstxt.org), so they can point people to the right page. */
export function GET() {
  const body = `# Ittsui Works (一対ワークス)

> Job board and project leads for commercial HVAC, data center and marine companies, in any country. English and Japanese.

Operated by Kuchimoto LLC, a Wyoming limited liability company. Contact: contact@ittsuiworks.com

## For technicians
- [Jobs](${SITE_URL}/jobs): live jobs for HVAC, data center and marine technicians. Applying is free; the application goes to the employer by email.
- Job alerts: new jobs in a chosen trade and country, by email, free.

## For companies
- [Post a job](${SITE_URL}/post-job): free, live for 30 days once the email is confirmed.
- [Get project leads](${SITE_URL}/companies): projects in your trade and country by email; pay only for the leads you take; each project goes to three companies at most.

## For buyers (facility owners, data center builders, shipowners)
- [Post a project](${SITE_URL}/post-project): free. Only projects with secured power, an approved budget and a start date reach companies.

## Other
- [Japanese site](${SITE_URL}/ja)
- [Job feed (XML)](${SITE_URL}/jobs.xml)
- [Terms](${SITE_URL}/terms) and [Privacy](${SITE_URL}/privacy)
`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
