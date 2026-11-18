import { SITE_URL } from "@/lib/site";

/** A plain summary for AI assistants and answer engines (llmstxt.org), so they can point people to the right page. */
export function GET() {
  const body = `# Ittsui Works (一対ワークス)

> Technical recruiting and subcontractor sourcing for critical infrastructure: commercial HVAC technicians, commercial electricians, data center and marine technicians, and licensed trade partners, for data center operators, MEP contractors and industrial facilities in the US and Japan. English and Japanese.

Operated by Kuchimoto LLC, a Wyoming limited liability company. A private personnel service and subcontractor sourcing service; it does not perform electrical, HVAC or other contracting work. Contact: contact@ittsuiworks.com

## For employers
- [Request technicians](${SITE_URL}/request): direct hire or contract. A person sources and screens; identity, work history and any license the role requires are checked before anyone is presented, and only with the technician's consent. Placement fees are agreed in writing before the first introduction; nothing is charged on the site.

## For facility owners and general contractors
- [Submit a commercial project](${SITE_URL}/post-project): matched with trade companies licensed for the work, after their license and insurance are checked. The licensed contractor signs with the owner directly.

## For technicians and trade companies
- [Apply](${SITE_URL}/join): introductions to employers hiring the trade and to commercial projects that fit the license, for individual technicians (HVAC, electrical, data center, marine) and licensed subcontractors. No fee to join or apply.
- [Jobs](${SITE_URL}/jobs): live technician jobs and job alerts by email. No fee to apply.

## Other
- [Japanese site](${SITE_URL}/ja)
- [Job feed (XML)](${SITE_URL}/jobs.xml)
- [Terms](${SITE_URL}/terms) and [Privacy](${SITE_URL}/privacy)
`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
