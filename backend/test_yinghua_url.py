#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Test Yinghua video URL extraction"""
from __future__ import print_function
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.yinghua_scraper import YinghuaScraper

def main():
    print("=== Testing YinghuaScraper ===")
    scraper = YinghuaScraper()
    
    # Test getting episode detail
    # The episode URL is: http://www.yinghuajinju.com/v/5907-139.html
    # So the episode_id should be: v/5907-139.html
    episode_id = "v%2F5907-139.html"  # URL encoded
    
    print("\n1. Testing get_episode_detail...")
    episode = scraper.get_episode_detail(episode_id)
    
    if episode:
        print("Episode detail:")
        print("  - ID: " + str(episode.get('id', 'N/A')))
        print("  - Title: " + str(episode.get('title', 'N/A')))
        print("  - Video URL: " + str(episode.get('videoUrl', 'N/A')))
        print("  - Play Page URL: " + str(episode.get('playPageUrl', 'N/A')))
        print("  - Source: " + str(episode.get('source', 'N/A')))
        
        if episode.get('videoUrl'):
            print("\n*** SUCCESS! Got video URL: " + episode['videoUrl'])
        else:
            print("\n*** WARNING: No video URL found")
    else:
        print("Failed to get episode detail")
    
    # Also test with series to get episodes
    print("\n2. Testing get_episodes...")
    series_id = "show%2F5907.html"  # URL encoded
    episodes = scraper.get_episodes(series_id)
    
    if episodes:
        print("Found " + str(len(episodes)) + " episodes")
        if len(episodes) > 0:
            print("First episode:")
            ep = episodes[0]
            print("  - ID: " + str(ep.get('id', 'N/A')))
            print("  - Title: " + str(ep.get('title', 'N/A')))
            print("  - Play Page URL: " + str(ep.get('playPageUrl', 'N/A')))
    else:
        print("No episodes found")

if __name__ == '__main__':
    main()
