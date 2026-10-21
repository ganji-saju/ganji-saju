// 무통장 입금 계좌(Vercel env). 하나라도 비면 무통장을 받지 않는다 — 화면 선택지도 숨긴다.
export interface ReportBankAccount {
  bank: string;
  account: string;
  holder: string;
}

export function getReportBankAccount(): ReportBankAccount | null {
  const bank = process.env.REPORT_BANK_NAME?.trim();
  const account = process.env.REPORT_BANK_ACCOUNT?.trim();
  const holder = process.env.REPORT_BANK_HOLDER?.trim();
  return bank && account && holder ? { bank, account, holder } : null;
}
