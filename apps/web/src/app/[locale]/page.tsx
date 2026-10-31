import { setRequestLocale } from 'next-intl/server';
import { About } from '@/components/home/About';
import { Advantages } from '@/components/home/Advantages';
import { Fleet } from '@/components/home/Fleet';
import { Hero } from '@/components/home/Hero';
import { PopularDestinations } from '@/components/home/PopularDestinations';
import type { Locale } from '@/i18n/routing';

type Props = { params: Promise<{ locale: string }> };

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  return (
    <>
      <Hero />
      <Advantages />
      <Fleet />
      <PopularDestinations />
      <About />
    </>
  );
}
