from playwright.sync_api import sync_playwright, Page, expect

def verify_pagination_and_search(page: Page):
    """
    This test verifies that the pagination and search functionality on the
    admin dashboard works correctly.
    """
    # 1. Arrange: Go to the admin dashboard.
    page.goto("http://localhost:3000/admin.html")

    # 2. Assert: Verify initial pagination state.
    expect(page.locator("#verifications-tbody tr")).to_have_count(20, timeout=10000)
    expect(page.get_by_role("button", name="Next")).to_be_enabled()
    expect(page.get_by_role("button", name="Previous")).to_be_disabled()
    page.screenshot(path="jules-scratch/verification/pagination_page_1.png")

    # 3. Act: Click the 'Next' button to go to page 2.
    page.get_by_role("button", name="Next").click()
    expect(page.locator("#verifications-tbody tr")).to_have_count(5)
    expect(page.get_by_role("button", name="Next")).to_be_disabled()
    expect(page.get_by_role("button", name="Previous")).to_be_enabled()
    page.screenshot(path="jules-scratch/verification/pagination_page_2.png")

    # 4. Act: Search for a specific student.
    search_input = page.locator("#search-input")
    search_input.fill("student2")
    page.keyboard.press("Enter")
    # Assert: Should find students 2, 20, 21, 22, 23, 24, 25.
    expect(page.locator("#verifications-tbody tr")).to_have_count(7)
    expect(page.locator("td", has_text="student2@example.com")).to_be_visible()
    page.screenshot(path="jules-scratch/verification/search_results.png")

# Main execution block
if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        verify_pagination_and_search(page)
        browser.close()
