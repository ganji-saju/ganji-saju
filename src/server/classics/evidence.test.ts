import assert from 'node:assert/strict';
import {
  getClassicConceptForEvidenceKey, getClassicVerificationLabel,
  isUsableClassicEvidenceRow, type ClassicEvidenceRow,
} from './evidence';

declare const test: (name: string, fn: () => void) => void;

test('getClassicConceptForEvidenceKey maps evidence cards to real classic search concepts', () => {
  assert.equal(getClassicConceptForEvidenceKey('yongsin'), '용신');
  assert.equal(getClassicConceptForEvidenceKey('strength'), '강약');
  assert.equal(getClassicConceptForEvidenceKey('pattern'), '격국');
  assert.equal(getClassicConceptForEvidenceKey('relations'), '합충');
  assert.equal(getClassicConceptForEvidenceKey('gongmang'), '공망');
  assert.equal(getClassicConceptForEvidenceKey('specialSals'), '신살');
});

test('classic evidence rejects unreleased/unverified or unattributed source text', () => {
  const row = {
    passage_id: 'source-passage', original_text_zh: '陰陽之道',
    source_url: 'https://zh.wikisource.org/wiki/滴天髓', source_work_ref: 'title=滴天髓',
    effective_license_label: 'CC BY-SA 4.0', public_release_status: 'live',
    verification_status: 'provisional',
  } as ClassicEvidenceRow;
  assert.equal(isUsableClassicEvidenceRow(row), true);
  for (const patch of [
    { public_release_status: 'hold' }, { verification_status: 'blocked' },
    { verification_status: 'unreviewed' }, { original_text_zh: ' ' },
    { source_url: null }, { source_work_ref: '' }, { effective_license_label: null },
  ]) assert.equal(isUsableClassicEvidenceRow({ ...row, ...patch }), false);
  assert.match(getClassicVerificationLabel('provisional'), /전문 검수 전/);
  assert.equal(getClassicVerificationLabel('reviewed'), '원문 검수 완료');
});
