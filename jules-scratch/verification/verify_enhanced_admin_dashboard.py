from playwright.sync_api import sync_playwright, Page, expect

def verify_enhanced_admin_dashboard_with_logs(page: Page):
    """
    This test verifies the admin dashboard's empty state and captures console logs
    for debugging potential JavaScript errors.
    """
    # 1. Arrange: Set up a listener to print browser console messages.
    page.on("console", lambda msg: print(f"BROWSER CONSOLE: {msg.type} >> {msg.text}"))

    # 2. Act: Go to the admin dashboard page.
    page.goto("http://localhost:3000/admin.html")

    # 3. Assert: Wait for the heading to be visible.
    expect(page.get_by_role("heading", name="Student Verification Dashboard")).to_be_visible()

    # 4. Assert: Wait for the loading state to be updated to the "empty" message.
    # The console log listener will now tell us if a JS error is preventing this.
    loading_state = page.locator("#loading-state")
    expect(loading_state).to_have_text("No verification requests found.", timeout=10000)

    # 5. Screenshot: Capture the state for visual verification.
    page.screenshot(path="jules-scratch/verification/enhanced_admin_dashboard.png")

# Main execution block
if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        verify_enhanced_admin_dashboard_with_logs(page)
        browser.close()
