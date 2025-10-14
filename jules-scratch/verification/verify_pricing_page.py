from playwright.sync_api import sync_playwright, Page, expect

def verify_pricing_page(page: Page):
    """
    This test verifies that the pricing page loads correctly and displays the
    pricing cards.
    """
    # 1. Arrange: Go to the application's homepage.
    page.goto("http://localhost:3000")

    # 2. Assert: Check that the main heading is visible.
    heading = page.get_by_role("heading", name="HackHaven")
    expect(heading).to_be_visible()

    # 3. Assert: Check that the pricing section is visible.
    pricing_section = page.locator("#pricing")
    expect(pricing_section).to_be_visible()

    # 4. Assert: Check that all three pricing cards are present.
    monthly_card = page.get_by_role("heading", name="Monthly")
    yearly_card = page.get_by_role("heading", name="Yearly")
    student_card = page.get_by_role("heading", name="Student")

    expect(monthly_card).to_be_visible()
    expect(yearly_card).to_be_visible()
    expect(student_card).to_be_visible()

    # 5. Screenshot: Capture the final result for visual verification.
    page.screenshot(path="jules-scratch/verification/verification.png")

# It's good practice to run the verification within a main block
# to make the script reusable and import-safe.
if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        verify_pricing_page(page)
        browser.close()
