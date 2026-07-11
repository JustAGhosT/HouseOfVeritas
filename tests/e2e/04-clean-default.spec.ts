import { expect, test } from "@playwright/test"
import { seedSession } from "./helpers/auth"

const adminUser = { id: "hans", role: "admin" as const, email: "smit.jurie@gmail.com" }
const cleanModeText = /Demo Mode|Using demo data|demo-user/i

test.describe.configure({ timeout: 60000 })

test.describe("clean-default mode", () => {
  test("public and authenticated APIs return empty mode without seeded data", async ({
    context,
    request,
  }) => {
    const health = await request.get("/api/health")
    expect(health.ok()).toBeTruthy()
    expect(await health.json()).toEqual(
      expect.objectContaining({
        dataMode: "empty",
      })
    )

    const documents = await request.get("/api/documents")
    expect(documents.ok()).toBeTruthy()
    expect(await documents.json()).toEqual([])

    const templates = await request.get("/api/documents/templates")
    expect(templates.ok()).toBeTruthy()
    expect(await templates.json()).toEqual(
      expect.objectContaining({
        configured: false,
        templates: [],
      })
    )

    await seedSession(context, adminUser)

    const stats = await context.request.get("/api/stats")
    expect(stats.ok()).toBeTruthy()
    expect(await stats.json()).toEqual(
      expect.objectContaining({
        dataSource: "empty",
        users: expect.objectContaining({ total: 0, active: 0, names: [] }),
        tasks: expect.objectContaining({ total: 0 }),
        expenses: expect.objectContaining({ pending: 0, approved: 0 }),
      })
    )

    const calendarStatus = await context.request.get("/api/calendar?action=status")
    expect(calendarStatus.ok()).toBeTruthy()
    expect(await calendarStatus.json()).toEqual(
      expect.objectContaining({ configured: false, mode: "empty" })
    )

    const calendar = await context.request.get("/api/calendar")
    expect(calendar.ok()).toBeTruthy()
    expect(await calendar.json()).toEqual(
      expect.objectContaining({ mode: "empty", items: [], count: 0 })
    )

    const biometricStatus = await context.request.get("/api/biometric?action=status")
    expect(biometricStatus.ok()).toBeTruthy()
    expect(await biometricStatus.json()).toEqual(
      expect.objectContaining({
        configured: false,
        mode: "empty",
        devices: [],
        enrolledEmployees: 0,
        todayRecords: 0,
      })
    )

    const biometric = await context.request.get("/api/biometric")
    expect(biometric.ok()).toBeTruthy()
    expect(await biometric.json()).toEqual(
      expect.objectContaining({
        mode: "empty",
        records: [],
        employeeStatus: [],
        summary: expect.objectContaining({ totalRecords: 0 }),
      })
    )

    const payroll = await context.request.get("/api/payroll?month=2026-07")
    expect(payroll.ok()).toBeTruthy()
    expect(await payroll.json()).toEqual(
      expect.objectContaining({
        mode: "empty",
        employees: [],
        totals: expect.objectContaining({
          totalGrossPay: 0,
          totalDeductions: 0,
          totalNetPay: 0,
          totalHours: 0,
          totalOvertime: 0,
        }),
      })
    )
  })

  test("browser smoke shows empty integration states without demo badges", async ({
    context,
    page,
  }) => {
    await seedSession(context, adminUser)

    await page.goto("/dashboard/hans/calendar")
    await expect(page.getByText("Google Calendar not configured")).toBeVisible()
    await expect(page.getByText("No upcoming events")).toBeVisible()
    await expect(page.locator("body")).not.toContainText(cleanModeText)

    await page.goto("/dashboard/hans/payroll")
    await expect(page.getByText("QuickBooks not configured")).toBeVisible()
    await expect(page.locator("body")).not.toContainText(cleanModeText)

    await page.getByRole("button", { name: "Biometric" }).click()
    await expect(page.getByText("Biometric devices not configured")).toBeVisible()
    await expect(page.locator("body")).not.toContainText(cleanModeText)

    await page.goto("/dashboard/hans/documents")
    await expect(page.getByText("No documents found.")).toBeVisible()
    await expect(page.locator("body")).not.toContainText(cleanModeText)

    await page.goto("/login")
    await expect(page.getByTestId("login-submit")).toContainText("Continue with Mystira")
    await expect(page.locator("body")).not.toContainText(/demo-user|Demo Mode/i)
  })
})
