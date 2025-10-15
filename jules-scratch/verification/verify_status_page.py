from playwright.sync_api import sync_playwright, Page, expect

def verify_student_status_page_approved(page: Page):
    """
    This test verifies that the student status page correctly renders the 'approved'
    state based on the mock data in the JavaScript.
    """
    # 1. Arrange: Go to the new student status page with a test email.
    page.goto("http://localhost:3000/student_status.html?email=student@example.edu")

    # 2. Assert: Wait for the loading spinner to disappear and the status card to be visible.
    loading_spinner = page.locator("#loading-spinner")
    status_card = page.locator("#status-card")
    expect(loading_spinner).not_to_be_visible(timeout=10000)
    expect(status_card).to_be_visible(timeout=10000)

    # 3. Assert: Check that the status is 'approved' and the correct message is shown.
    status_label = page.locator("#status-label")
    expect(status_label).to_have_text("approved")
    expect(status_label).to_have_class("status-approved")

    status_message = page.locator("#status-message")
    expect(status_message).to_have_text("Your verification is approved! Complete your subscription below.")

    # 4. Assert: Check that the Stripe section is visible and contains the URL.
    stripe_section = page.locator("#stripe-section")
    expect(stripe_section).to_be_visible()
    stripe_url_input = page.locator("#stripe-url")
    expect(stripe_url_input).to_have_value("https://checkout.stripe.com/pay/cs_test_a1b2c3d4e5f6")

    # 5. Screenshot: Capture the 'approved' state for visual verification.
    page.screenshot(path="jules-scratch/verification/status_page_approved.png")

# Main execution block
if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        verify_student_status_page_approved(page)
        browser.close()
