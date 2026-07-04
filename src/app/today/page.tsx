import { permanentRedirect } from 'next/navigation';

export default function TodayAliasPage() {
  permanentRedirect('/today-fortune?concern=general');
}
