import { expect, type Locator, type Page } from "@playwright/test";

export async function pressTab(page: Page, count = 1) {
  for (let i = 0; i < count; i++) {
    await page.keyboard.press("Tab");
  }
}

export async function pressShiftTab(page: Page, count = 1) {
  for (let i = 0; i < count; i++) {
    await page.keyboard.press("Shift+Tab");
  }
}

export async function pressEnter(page: Page) {
  await page.keyboard.press("Enter");
}

export async function pressSpace(page: Page) {
  await page.keyboard.press("Space");
}

export async function pressEscape(page: Page) {
  await page.keyboard.press("Escape");
}

export async function expectFocused(locator: Locator) {
  await expect(locator).toBeFocused();
}

export async function fillActiveElement(page: Page, text: string) {
  await page.keyboard.type(text);
}

export async function tabUntilFocused(
  page: Page,
  target: Locator,
  maxTabs = 25,
) {
  for (let i = 0; i < maxTabs; i++) {
    const isTargetFocused = await target
      .evaluate((node) => node === document.activeElement)
      .catch(() => false);
    if (isTargetFocused) {
      return;
    }
    await page.keyboard.press("Tab");
  }
  await expect(target).toBeFocused();
}
