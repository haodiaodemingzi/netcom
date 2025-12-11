import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.ttkan_scraper import TtkanScraper

scraper = TtkanScraper()

print("Testing page 1...")
result1 = scraper.get_books_by_category("youxi", page=1, limit=18)
books1 = result1.get("books", [])
print("Page 1: Got %d books" % len(books1))
print("Has more: %s" % result1.get("hasMore", False))
if books1:
    print("First book: %s" % books1[0].get("title", "No title"))

print("\nTesting page 2...")
result2 = scraper.get_books_by_category("youxi", page=2, limit=18)
books2 = result2.get("books", [])
print("Page 2: Got %d books" % len(books2))
print("Has more: %s" % result2.get("hasMore", False))
if books2:
    print("First book: %s" % books2[0].get("title", "No title"))
    print("Author: %s" % books2[0].get("author", "No author"))

print("\nTesting page 3...")
result3 = scraper.get_books_by_category("gudaiyanqing", page=3, limit=18)
books3 = result3.get("books", [])
print("Page 3: Got %d books" % len(books3))
if books3:
    print("First book: %s" % books3[0].get("title", "No title"))
