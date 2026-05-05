import { redirect } from 'next/navigation';

interface PayAliasPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function buildCheckoutHref(params: Record<string, string | string[] | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') query.set(key, value);
    else if (Array.isArray(value) && value[0]) query.set(key, value[0]);
  }
  const queryString = query.toString();
  return queryString ? `/membership/checkout?${queryString}` : '/membership/checkout';
}

export default async function PayAliasPage({ searchParams }: PayAliasPageProps) {
  redirect(buildCheckoutHref((await searchParams) ?? {}));
}
