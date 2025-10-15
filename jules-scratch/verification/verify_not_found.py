from playwright.sync_api import sync_playwright, Page, expect

def verify_not_found_error(page: Page):
    """
    This test verifies that the student status page correctly displays a
    'not found' error when the backend returns a 404 response.
    """
    # 1. Arrange: Go to the status page with an email that is not in the database.
    email_not_in_db = "nouser@example.com"
    page.goto(f"http://localhost:3000/student_status.html?email={email_not_in_db}")

    # 2. Assert: Wait for the loading spinner to disappear and the error message to be visible.
    loading_spinner = page.locator("#loading-spinner")
    error_message = page.locator("#error-message")

    expect(loading_spinner).not_to_be_visible(timeout=10000)
    expect(error_message).to_be_visible(timeout=10000)

    # 3. Assert: Check that the error message contains the expected text from the backend.
    expect(error_message).to_have_text("No verification status was found for the provided email address.")

    # 4. Screenshot: Capture the error state for visual verification.
    page.screenshot(path="jules-scratch/verification/status_page_not_found.png")

# Main execution block
if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        verify_not_found_error(page)
        browser.close()
