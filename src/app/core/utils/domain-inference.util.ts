import { DEFAULT_DOMAIN } from '../models/settings.model';

export function inferDomain(text: string, domains: string[]): string {
  if (domains.length === 0) return DEFAULT_DOMAIN;
  const lower = text.toLowerCase();
  for (const domain of domains) {
    if (lower.includes(domain.toLowerCase())) return domain;
  }
  return domains[0];
}

export function parseDomainFromResponse(text: string, domains: string[]): string {
  const match = text.match(/INFERRED_DOMAIN:\s*(.+)/);
  if (!match) return inferDomain(text, domains);
  const raw = match[1].trim();
  if (domains.length === 0) return DEFAULT_DOMAIN;
  const exact = domains.find((d) => d.toLowerCase() === raw.toLowerCase());
  if (exact) return exact;
  return domains[0];
}

export function stripInferredDomainLine(text: string): string {
  return text.replace(/\n?INFERRED_DOMAIN:\s*.+\s*$/i, '').trimEnd();
}
