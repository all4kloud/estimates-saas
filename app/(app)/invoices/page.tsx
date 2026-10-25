import { DocList } from '../DocList';

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  return <DocList type="invoice" sp={await searchParams} />;
}
