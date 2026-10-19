import { useTranslation } from 'react-i18next';

// h0pp EU (проверка платёжным провайдером): поддержка, политика возвратов и кодовое
// слово в подвале — параметрами сборки. Не заданы — ничего не выводится (RU как было).
const SUPPORT_URL = import.meta.env.VITE_SUPPORT_URL || '';
const REFUND_URL = import.meta.env.VITE_REFUND_URL || '';
const CODEWORD = import.meta.env.VITE_FOOTER_CODEWORD || '';

export default function FooterExtras({ linkClassName }: { linkClassName: string }) {
  const { t } = useTranslation();
  return (
    <>
      {SUPPORT_URL && (
        <a href={SUPPORT_URL} target="_blank" rel="noopener noreferrer" className={linkClassName}>
          {t('footer.support', 'Support')}
        </a>
      )}
      {REFUND_URL && (
        <a href={REFUND_URL} target="_blank" rel="noopener noreferrer" className={linkClassName}>
          {t('footer.refund', 'Refund Policy')}
        </a>
      )}
      {CODEWORD && <span>{CODEWORD}</span>}
    </>
  );
}
