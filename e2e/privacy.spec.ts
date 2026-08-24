import { test, expect, type Page } from '@playwright/test';
import { seed, income, expense, category, dayIn, type SeedEvent } from './helpers';

const base: SeedEvent[] = [
  category('Groceries'),
  category('Rent'),
  income(2400, 'Salary', dayIn(-1)),
  income(2400, 'Salary', dayIn(0)),
  expense(915.5, 'Rent', dayIn(-1)),
  expense(915.5, 'Rent', dayIn(0)),
  expense(64.2, 'Groceries', dayIn(0), 'Lidl'),
  expense(31.75, 'Groceries', dayIn(-1), 'Continente'),
  { id: 'b1', type: 'budget_set', timestamp: dayIn(-1), category: 'Groceries', amount: 300 },
];

/**
 * Every visible amount on the page that is NOT covered by the blur.
 *
 * This is the point of the spec. There are over a hundred places money is
 * rendered, so a hand-written list of "the ones I remembered to mark" is a leak
 * waiting to happen — and a leak in this feature is total, because the person
 * you turned the screen towards is looking right at it. Letting the browser
 * enumerate the misses turns "did I miss one" from a guess into an assertion.
 */
async function unblurredAmounts(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const money = /\d[\d  .,]*\s?€/;
    const leaks: string[] = [];

    for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
      // Only elements whose own text is the amount, so a wrapping <div> is not
      // reported alongside the <span> that actually holds the figure.
      const own = Array.from(el.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent ?? '')
        .join('');
      if (!money.test(own)) continue;

      const style = getComputedStyle(el);
      if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0) continue;

      // Not painted anywhere on the page. Recharts keeps a text-measuring span
      // parked at -20000px, which is in the DOM and readable to a query but has
      // never been on screen — counting it would be crying wolf forever.
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0 || rect.bottom < 0 || rect.right < 0) continue;

      // Blur may sit on the element or on anything above it.
      let node: HTMLElement | null = el;
      let blurred = false;
      while (node) {
        if (/blur\(/.test(getComputedStyle(node).filter)) {
          blurred = true;
          break;
        }
        node = node.parentElement;
      }
      if (!blurred) leaks.push(`${el.tagName.toLowerCase()}.${el.className || '(no class)'} :: ${own.trim().slice(0, 60)}`);
    }
    return leaks;
  });
}

async function hideAmounts(page: Page) {
  await page.getByRole('button', { name: 'Hide amounts' }).click();
}

test.describe('privacy mode', () => {
  test('hides every amount on the overview', async ({ page }) => {
    await seed(page, base);
    await page.goto('/');
    await expect(page.getByText('Balance', { exact: true }).or(page.getByText('Net worth', { exact: true }))).toBeVisible();

    await hideAmounts(page);
    expect(await unblurredAmounts(page)).toEqual([]);
  });

  test('hides every amount on every other tab too', async ({ page }) => {
    await seed(page, base);
    await page.goto('/');
    await hideAmounts(page);

    for (const tab of ['Entries', 'Plan', 'IRS', 'Portfolio', 'Markets'] as const) {
      await page.getByRole('button', { name: tab, exact: true }).click();
      await expect(page.getByRole('button', { name: 'Show amounts' })).toBeVisible();
      expect(await unblurredAmounts(page), `leaked on ${tab}`).toEqual([]);
    }
  });

  test('hides the amounts inside a drilled-down slice', async ({ page }) => {
    // Overlays render through a portal, outside the page subtree — exactly the
    // kind of place a blur applied to a container would miss.
    await seed(page, base);
    await page.goto('/');
    await hideAmounts(page);

    await page.getByRole('button', { name: 'Show what makes up Groceries' }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect(await unblurredAmounts(page)).toEqual([]);
  });

  test('survives a reload, so turning the screen round after one is safe', async ({ page }) => {
    await seed(page, base);
    await page.goto('/');
    await hideAmounts(page);
    await page.reload();

    await expect(page.getByRole('button', { name: 'Show amounts' })).toBeVisible();
    expect(await unblurredAmounts(page)).toEqual([]);
  });

  test('gives the figures back', async ({ page }) => {
    await seed(page, base);
    await page.goto('/');
    await hideAmounts(page);
    expect(await unblurredAmounts(page)).toEqual([]);

    await page.getByRole('button', { name: 'Show amounts' }).click();
    // The same detector, now expected to find plenty — proof the blur was the
    // thing hiding them and not an empty page.
    expect((await unblurredAmounts(page)).length).toBeGreaterThan(3);
  });

  test('is off until asked for', async ({ page }) => {
    await seed(page, base);
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Hide amounts' })).toBeVisible();
    expect((await unblurredAmounts(page)).length).toBeGreaterThan(3);
  });
});
