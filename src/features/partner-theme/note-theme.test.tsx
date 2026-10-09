// @vitest-environment node
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BUSINESS_INFO } from '@/lib/business-info';
import { NOTE_METADATA, NoteNotice, NoteShell } from './note-theme';

describe('NoteShell', () => {
  const html = renderToStaticMarkup(<NoteShell><p>본문</p></NoteShell>);

  it('글자 로고·본문·사업자 정보·약관 링크', () => {
    expect(html).toContain('올해운 노트');
    expect(html).toContain('본문');
    expect(html).toContain(BUSINESS_INFO.companyName);
    expect(html).toContain('href="/terms"');
    expect(html).toContain('href="/privacy"');
  });

  it('결제 버튼 등 재사용 컴포넌트의 간지사주 색 변수를 테마 색으로 덮는다', () => {
    expect(html).toContain('--app-pink:#C8443A');
    expect(html).toContain('--app-ink:#1F2A44');
  });

  it('간지사주 이름·한자 없음(사업자 상호 줄 제외)', () => {
    const withoutBusiness = html.replace(BUSINESS_INFO.companyName, '');
    expect(withoutBusiness).not.toContain('간지사주');
    expect(html).not.toMatch(/[一-鿿]/);
  });

  it('NoteNotice', () => {
    expect(renderToStaticMarkup(<NoteNotice title="지금은 이용할 수 없는 링크입니다." />)).toContain('지금은 이용할 수 없는 링크입니다.');
  });

  it('제목은 템플릿을 끊고(absolute) 공유 미리보기 이름도 올해운 노트', () => {
    expect(NOTE_METADATA.title).toEqual({ absolute: '올해운 노트' });
    expect(NOTE_METADATA.openGraph?.siteName).toBe('올해운 노트');
    expect(NOTE_METADATA.robots).toEqual({ index: false, follow: false });
  });
});
