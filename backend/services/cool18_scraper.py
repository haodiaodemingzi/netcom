import logging

from services.generic_bbs_ebook_scraper import GenericBbsEbookScraper

logger = logging.getLogger(__name__)


class Cool18Scraper(GenericBbsEbookScraper):
    def __init__(self, proxy_config=None):
        super().__init__('cool18', proxy_config)
