import { getTranslations } from 'next-intl/server';
import styles from './home.module.css';

export async function About() {
  const t = await getTranslations('home.about');
  const list = (key: 'why.items' | 'border.items') => t.raw(key) as string[];

  return (
    <section
      className={`section ${styles.about}`}
      aria-labelledby="about-title"
    >
      <h2 id="about-title">{t('title')}</h2>
      <p className="lead">{t('lead')}</p>
      <details>
        <summary>{t('readMore')}</summary>
        <div className={styles.aboutGrid}>
          <div>
            <h3>{t('why.title')}</h3>
            <ul>
              {list('why.items').map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3>{t('howToBook.title')}</h3>
            <ol>
              {(t.raw('howToBook.steps') as string[]).map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
          <div>
            <h3>{t('border.title')}</h3>
            <ul>
              {list('border.items').map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3>{t('czechia.title')}</h3>
            <p>{t('czechia.text')}</p>
          </div>
        </div>
      </details>
    </section>
  );
}
