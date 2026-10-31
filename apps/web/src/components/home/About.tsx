import { getTranslations } from 'next-intl/server';

export async function About() {
  const t = await getTranslations('home.about');
  const list = (key: 'why.items' | 'border.items') => t.raw(key) as string[];

  return (
    <section className="section" aria-labelledby="about-title">
      <h2 id="about-title">{t('title')}</h2>
      <p>{t('lead')}</p>
      <details>
        <summary>{t('readMore')}</summary>
        <h3>{t('why.title')}</h3>
        <ul>
          {list('why.items').map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <h3>{t('howToBook.title')}</h3>
        <ol>
          {(t.raw('howToBook.steps') as string[]).map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <h3>{t('border.title')}</h3>
        <ul>
          {list('border.items').map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <h3>{t('czechia.title')}</h3>
        <p>{t('czechia.text')}</p>
      </details>
    </section>
  );
}
