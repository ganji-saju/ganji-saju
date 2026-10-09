// 올해운 노트 흐름(/partner/start·login·checkout) 공통 레이아웃. /partner/go(라우트 핸들러)는 그룹 밖이라 영향 없음.
import type { ReactNode } from 'react';
import { NOTE_METADATA, NoteShell } from '@/features/partner-theme/note-theme';

export const metadata = NOTE_METADATA;

export default function PartnerThemeLayout({ children }: { children: ReactNode }) {
  return <NoteShell>{children}</NoteShell>;
}
