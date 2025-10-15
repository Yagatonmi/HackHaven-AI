from playwright.sync_api import sync_playwright, Page, expect

def verify_live_badge_appears(page: Page):
    """
    This test verifies that the 'Live' badge appears on the student status page,
    confirming that the EventSource connection was initiated.
    """
    # 1. Arrange: Go to the student status page.
    # The page will be temporarily modified to include a valid token.
    page.goto("http://localhost:3000/student_status.html?token=test_token_for_verification")

    # 2. Assert: Wait for the loading spinner to disappear.
    loading_spinner = page.locator("#loading-spinner")
    expect(loading_spinner).not_to_be_visible(timeout=10000)

    # 3. Assert: Check that the "Live" badge is now visible.
    live_badge = page.locator(".live-badge")
    expect(live_badge).to_be_visible()
    expect(live_badge).to_have_text("(Live)")

    # 4. Screenshot: Capture the page with the live badge.
    page.screenshot(path="jules-scratch/verification/live_badge_verification.png")

# Main execution block
if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        verify_live_badge_appears(page)
        browser.close()
