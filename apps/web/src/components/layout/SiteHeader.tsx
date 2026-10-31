import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { LanguageSwitcher } from './LanguageSwitcher';
import { NavLinks } from './NavLinks';

export async function SiteHeader() {
  const t = await getTranslations('common');

  return (
    <header className="site-header">
      <Link href="/" className="brand">
        <Image src="/logo.png" alt="" width={36} height={36} priority />
        <span>{t('brand')}</span>
      </Link>
      <NavLinks />
      <LanguageSwitcher />
    </header>
  );
}
