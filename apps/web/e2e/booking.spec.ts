import { expect, test, type Page } from '@playwright/test';
import cs from '../messages/cs.json';
import uk from '../messages/uk.json';

// The whole booking through the site: search → bus → passengers → review →
// mock payment → ticket and download. Needs the dev API stack (migrated and
// seeded). Each run books real seats in the dev database.

const PRAHA = '8';
const KYIV = '1';
const CHILD_5_TO_11 = '3'; // seeded discount id

const LOCALES = [
  { locale: 'uk', t: uk },
  { locale: 'cs', t: cs }
] as const;

/** Picks the n-th bookable date of a date <select> (0 = the first). */
async function pickDate(page: Page, label: string, n: number) {
  const select = page.getByRole('combobox', { name: label, exact: true });
  await expect(select).toBeEnabled();
  const values = await select
    .locator('option')
    .evaluateAll((options) =>
      options.map((o) => (o as HTMLOptionElement).value).filter(Boolean)
    );
  expect(values.length).toBeGreaterThan(n);
  await select.selectOption(values[n]);
  return values[n];
}

for (const { locale, t } of LOCALES) {
  test(`books Praha → Kyiv for two adults and a child (${locale})`, async ({
    page
  }) => {
    // ── Search ────────────────────────────────────────────────────────────
    await page.goto(`/${locale}`);
    await page
      .getByRole('combobox', { name: t.search.from, exact: true })
      .selectOption(PRAHA);
    await page
      .getByRole('combobox', { name: t.search.to, exact: true })
      .selectOption(KYIV);
    // A few departures out, clear of today and of other runs' bookings
    const departure = await pickDate(page, t.search.departure, 3);
    await page
      .getByRole('combobox', { name: t.search.adults, exact: true })
      .selectOption('2');
    await page
      .getByRole('combobox', { name: t.search.children, exact: true })
      .selectOption('1');
    await page.getByRole('button', { name: t.search.submit }).click();

    // ── Results ───────────────────────────────────────────────────────────
    await expect(page).toHaveURL(
      new RegExp(`/${locale}/search\\?.*startDate=${departure}`)
    );
    await page.getByRole('button', { name: t.results.select }).first().click();

    // ── Passengers ────────────────────────────────────────────────────────
    await expect(page).toHaveURL(new RegExp(`/${locale}/booking/passengers`));
    await expect(
      page.getByRole('heading', { name: t.passengers.title })
    ).toBeVisible();

    const fill = async (index: number, field: string, value: string) =>
      page.locator(`#p${index}-${field}`).fill(value);
    await fill(0, 'name', 'Jana');
    await fill(0, 'lastName', 'Novakova');
    await fill(0, 'dateOfBirth', '1985-03-20');
    // A German number is refused before anything is sent
    await fill(0, 'phone', '+4915112345678');
    await fill(0, 'email', 'e2e@busora.test');
    await fill(1, 'name', 'Petr');
    await fill(1, 'lastName', 'Novak');
    await fill(1, 'dateOfBirth', '1983-07-11');
    await fill(1, 'phone', '+420777123456');
    await fill(2, 'name', 'Eva');
    await fill(2, 'lastName', 'Novakova');
    const childBirthYear = Number(departure.slice(0, 4)) - 7;
    await fill(2, 'dateOfBirth', `${childBirthYear}-01-15`);
    await page.locator('#p2-discountId').selectOption(CHILD_5_TO_11);

    await page.getByRole('button', { name: t.passengers.submit }).click();
    await expect(page.locator('#p0-phone-error')).toHaveText(
      t.passengers.invalidPhone
    );

    await fill(0, 'phone', '+420601123456');
    await page.getByRole('button', { name: t.passengers.submit }).click();

    // ── Review ────────────────────────────────────────────────────────────
    await expect(page).toHaveURL(new RegExp(`/${locale}/booking/review`));
    await expect(page.getByText('Eva Novakova')).toBeVisible();
    await page.getByRole('button', { name: t.review.pay }).click();

    // ── Mock payment ──────────────────────────────────────────────────────
    await expect(page).toHaveURL(new RegExp(`/${locale}/booking/payment`));
    await page.getByRole('button', { name: /₴|UAH/ }).click();

    // ── Ticket ────────────────────────────────────────────────────────────
    await expect(page).toHaveURL(new RegExp(`/${locale}/booking/success`));
    await expect(
      page.getByRole('heading', { name: t.success.title })
    ).toBeVisible();
    await expect(page.getByText('Petr Novak')).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: t.success.download }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('Busora_Tickets.zip');
  });
}

test('a declined payment shows the failure page (en)', async ({ page }) => {
  await page.goto('/en');
  await page
    .getByRole('combobox', { name: 'From', exact: true })
    .selectOption(KYIV);
  await page
    .getByRole('combobox', { name: 'To', exact: true })
    .selectOption(PRAHA);
  await pickDate(page, 'Departure', 4);
  await page.getByRole('button', { name: 'Search' }).click();
  await page.getByRole('button', { name: 'Select' }).first().click();

  await page.locator('#p0-name').fill('Ivan');
  await page.locator('#p0-lastName').fill('Petrenko');
  await page.locator('#p0-dateOfBirth').fill('1990-01-01');
  await page.locator('#p0-phone').fill('+380671234567');
  await page.locator('#p0-email').fill('e2e@busora.test');
  await page.getByRole('button', { name: 'Continue to review' }).click();
  await page.getByRole('button', { name: 'Go to payment' }).click();
  await page.getByRole('button', { name: 'Decline payment' }).click();

  await expect(page).toHaveURL(/\/en\/booking\/failed/);
  await expect(
    page.getByRole('heading', { name: 'The payment did not go through' })
  ).toBeVisible();
});

/** The first date on or after `from` (YYYY-MM-DD) whose weekday is `day`. */
function nextWeekday(from: Date, day: number) {
  const date = new Date(from);
  while (date.getUTCDay() !== day) date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

test('a round trip on days without buses picks the nearest outbound, then return (en)', async ({
  page
}) => {
  // Line 1 runs Kyiv → Praha Tue/Thu/Sat and back Wed/Fri/Sun: no Mondays
  const inDays = (n: number) => new Date(Date.now() + n * 864e5);
  const query = new URLSearchParams({
    originId: KYIV,
    destinationId: PRAHA,
    startDate: nextWeekday(inDays(12), 1),
    endDate: nextWeekday(inDays(19), 1),
    adults: '1',
    children: '0',
    currencyAbbr: 'UAH'
  });
  await page.goto(`/en/search?${query}`);

  await expect(
    page.getByRole('heading', { name: 'Nearest departures' })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Select' }).first().click();
  const returns = page.locator('section', {
    has: page.getByRole('heading', { name: 'Nearest return departures' })
  });
  // The return leg leaves Praha, not Kyiv
  await expect(returns.getByText(/Florenc/).first()).toBeVisible();
  await returns.getByRole('button', { name: 'Select' }).first().click();

  await expect(page).toHaveURL(/\/en\/booking\/passengers/);
  await page.locator('#p0-name').fill('Ivan');
  await page.locator('#p0-lastName').fill('Petrenko');
  await page.locator('#p0-dateOfBirth').fill('1990-01-01');
  await page.locator('#p0-phone').fill('+380671234567');
  await page.locator('#p0-email').fill('e2e@busora.test');
  await page.getByRole('button', { name: 'Continue to review' }).click();
  await page.getByRole('button', { name: 'Go to payment' }).click();
  await page.getByRole('button', { name: /^Pay / }).click();

  await expect(page).toHaveURL(/\/en\/booking\/success/);
  await expect(
    page.getByRole('heading', { name: 'Your booking is confirmed' })
  ).toBeVisible();
  // A round-trip ticket shows both dates
  await expect(page.getByText(/ – /)).toBeVisible();
});
