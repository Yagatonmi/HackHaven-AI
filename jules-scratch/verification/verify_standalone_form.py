from playwright.sync_api import sync_playwright, Page, expect

def verify_standalone_form_loads(page: Page):
    """
    This test verifies that the standalone student verification form page
    loads correctly and displays all required form elements.
    """
    # 1. Arrange: Go to the new student verification form page.
    page.goto("http://localhost:3000/student_verification_form.html")

    # 2. Assert: Check that the main heading and key form fields are visible.
    expect(page.get_by_role("heading", name="Student Verification")).to_be_visible()
    expect(page.get_by_label("Your Account Email (Required)")).to_be_visible()
    expect(page.get_by_label("1. Your .edu Email Address")).to_be_visible()
    expect(page.get_by_label("2. Upload your Student ID")).to_be_visible()
    expect(page.get_by_role("button", name="Submit Verification")).to_be_visible()

    # 3. Screenshot: Capture the form for visual verification.
    page.screenshot(path="jules-scratch/verification/standalone_form.png")

# Main execution block
if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        verify_standalone_form_loads(page)
        browser.close()
