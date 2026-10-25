import { DocList } from '../DocList';

export default async function EstimatesPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  return <DocList type="estimate" sp={await searchParams} />;
}
