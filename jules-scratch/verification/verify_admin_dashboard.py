from playwright.sync_api import sync_playwright, Page, expect

def verify_empty_admin_dashboard(page: Page):
    """
    This test verifies the admin dashboard's empty state and captures console logs
    for debugging.
    """
    # 1. Arrange: Set up a listener to print browser console messages to the output.
    page.on("console", lambda msg: print(f"BROWSER CONSOLE: {msg.type} >> {msg.text}"))

    # 2. Act: Go to the admin dashboard page.
    page.goto("http://localhost:3000/admin.html")

    # 3. Assert: Wait for the heading to be visible.
    heading = page.get_by_role("heading", name="Pending Student Verifications")
    expect(heading).to_be_visible()

    # 4. Assert: Wait for the loading state to contain the correct "empty" text.
    # We are still using the expect with a timeout, but the console logs will tell us
    # if a JS error is occurring.
    loading_state = page.locator("#loading-state")
    expect(loading_state).to_have_text("No pending verifications found.", timeout=10000)

    # 5. Assert: Ensure the table is not visible.
    table = page.locator("#verifications-table")
    expect(table).not_to_be_visible()

    # 6. Screenshot: Capture the empty state for visual verification.
    page.screenshot(path="jules-scratch/verification/admin_dashboard_empty_state.png")

# Main execution block
if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        verify_empty_admin_dashboard(page)
        browser.close()
