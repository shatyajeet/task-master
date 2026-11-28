import { expect, test } from "@playwright/test";

test("the home page renders the Workspaces heading", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Workspaces" })).toBeVisible();
});

test("the response carries the CSP", async ({ request }) => {
  const response = await request.get("/");
  expect(response.headers()["content-security-policy"]).toContain("img-src 'self' data:");
});

test("a request with another Host gets 403", async ({ request }) => {
  const response = await request.get("http://127.0.0.1:3000/", {
    headers: { Host: "evil.example:3000" },
  });
  expect(response.status()).toBe(403);
});
