export type ExternalReference = { href: string; label: string };

export function externalReference(value?: string): ExternalReference | undefined {
  const input = value?.trim();
  if (!input) return undefined;

  const markdown = input.match(/^\[([^\]]+)]\(([^)]+)\)$/);
  const candidate = markdown?.[2]?.trim() || input;

  try {
    const url = new URL(candidate);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined;
    return { href: url.toString(), label: markdown?.[1]?.trim() || 'Official source' };
  } catch {
    return undefined;
  }
}
