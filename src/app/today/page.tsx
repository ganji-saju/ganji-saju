import { redirect } from 'next/navigation';

export default function TodayAliasPage() {
  redirect('/today-fortune?concern=general');
}
