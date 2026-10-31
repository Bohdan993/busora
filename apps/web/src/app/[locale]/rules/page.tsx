import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Locale } from '@/i18n/routing';
import messages from '../../../../messages/en.json';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale: locale as Locale,
    namespace: 'rulesPage'
  });
  return { title: t('title') };
}

// Section ids follow the message keys, so the table of contents and the
// anchors stay in step with the text
const SECTIONS = Object.keys(messages.rulesPage.sections) as Array<
  keyof typeof messages.rulesPage.sections
>;

export default async function RulesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations('rulesPage');

  return (
    <>
      <h1>{t('title')}</h1>
      <p>{t('intro')}</p>
      <nav aria-labelledby="rules-contents">
        <h2 id="rules-contents">{t('contents')}</h2>
        <ol>
          {SECTIONS.map((key) => (
            <li key={key}>
              <a href={`#${key}`}>{t(`sections.${key}.title`)}</a>
            </li>
          ))}
        </ol>
      </nav>
      {SECTIONS.map((key) => (
        <section key={key} id={key} className="section">
          <h2>{t(`sections.${key}.title`)}</h2>
          {key === 'refunds' ? (
            <>
              <p>{t('sections.refunds.text')}</p>
              <table>
                <thead>
                  <tr>
                    <th scope="col">{t('sections.refunds.when')}</th>
                    <th scope="col">{t('sections.refunds.fee')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(
                    t.raw('sections.refunds.rows') as {
                      when: string;
                      fee: string;
                    }[]
                  ).map((row) => (
                    <tr key={row.when}>
                      <td>{row.when}</td>
                      <td>{row.fee}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <ol>
              {(t.raw(`sections.${key}.items`) as string[]).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          )}
        </section>
      ))}
    </>
  );
}
