#!/usr/bin/env python
# -*- coding: utf-8 -*-

import json
import requests

BASE_URL = 'http://localhost:5000/api'
SOURCE_ID = '原创视频'


def _safe_get(obj, key, default=None):
    if obj is None:
        return default
    if not isinstance(obj, dict):
        return default
    return obj.get(key, default)


def test_get_sources():
    print('\n========== test sources ==========', flush=True)
    resp = requests.get(f'{BASE_URL}/videos/sources', timeout=15)
    data = resp.json()

    print(f'status {resp.status_code}', flush=True)
    print(json.dumps(data, ensure_ascii=False, indent=2), flush=True)

    sources = _safe_get(data, 'sources', {})
    assert isinstance(sources, dict), 'sources should be dict'
    assert SOURCE_ID in sources, 'source should exist'


def test_get_categories():
    print('\n========== test categories ==========', flush=True)
    resp = requests.get(f'{BASE_URL}/videos/categories', params={'source': SOURCE_ID}, timeout=15)
    categories = resp.json()

    print(f'status {resp.status_code}', flush=True)
    print(f'count {len(categories) if isinstance(categories, list) else -1}', flush=True)

    assert isinstance(categories, list), 'categories should be list'
    assert len(categories) > 0, 'categories should not be empty'


def test_get_series_list(category='long-porn'):
    print('\n========== test series list ==========', flush=True)
    resp = requests.get(
        f'{BASE_URL}/videos/series',
        params={'source': SOURCE_ID, 'category': category, 'page': 1, 'limit': 5},
        timeout=20,
    )
    data = resp.json()

    print(f'status {resp.status_code}', flush=True)
    series = _safe_get(data, 'series', [])
    print(f'count {len(series)}', flush=True)

    assert isinstance(series, list), 'series should be list'
    assert len(series) > 0, 'series should not be empty'

    first = series[0]
    vid = _safe_get(first, 'id')
    title = _safe_get(first, 'title')
    print(f'first id {vid}', flush=True)
    print(f'first title {title}', flush=True)

    assert vid, 'video id should not be blank'
    return vid


def test_get_series_detail(video_id):
    print('\n========== test series detail ==========', flush=True)
    resp = requests.get(f'{BASE_URL}/videos/series/{video_id}', params={'source': SOURCE_ID}, timeout=20)
    detail = resp.json()

    print(f'status {resp.status_code}', flush=True)
    print(f"title {_safe_get(detail, 'title')}", flush=True)

    assert _safe_get(detail, 'id') == video_id, 'video id mismatch'


def test_get_episodes(video_id):
    print('\n========== test episodes ==========', flush=True)
    resp = requests.get(f'{BASE_URL}/videos/series/{video_id}/episodes', params={'source': SOURCE_ID}, timeout=20)
    episodes = resp.json()

    print(f'status {resp.status_code}', flush=True)
    print(f'count {len(episodes) if isinstance(episodes, list) else -1}', flush=True)

    assert isinstance(episodes, list), 'episodes should be list'
    assert len(episodes) > 0, 'episodes should not be empty'

    ep0 = episodes[0]
    assert _safe_get(ep0, 'id') == video_id, 'episode id mismatch'


def test_get_episode_detail(video_id):
    print('\n========== test episode detail ==========', flush=True)
    resp = requests.get(f'{BASE_URL}/videos/episodes/{video_id}', params={'source': SOURCE_ID}, timeout=20)
    episode = resp.json()

    print(f'status {resp.status_code}', flush=True)
    video_url = _safe_get(episode, 'videoUrl')
    print(f'videoUrl {str(video_url)[:120]}', flush=True)

    assert video_url, 'videoUrl should not be blank'


def test_search(keyword='porn'):
    print('\n========== test search ==========', flush=True)
    resp = requests.get(
        f'{BASE_URL}/videos/search',
        params={'source': SOURCE_ID, 'keyword': keyword, 'page': 1, 'limit': 5},
        timeout=20,
    )
    data = resp.json()

    print(f'status {resp.status_code}', flush=True)

    series = _safe_get(data, 'series', [])
    if not isinstance(series, list):
        raise AssertionError('search series should be list')

    print(f'count {len(series)}', flush=True)
    for item in series[:3]:
        print(f"- {_safe_get(item, 'title')}", flush=True)


def main():
    print('============================================================', flush=True)
    print('badnews original video api test', flush=True)
    print('============================================================', flush=True)

    test_get_sources()
    test_get_categories()

    video_id = test_get_series_list('long-porn')
    test_get_series_detail(video_id)
    test_get_episodes(video_id)
    test_get_episode_detail(video_id)

    test_search('porn')

    print('\nall tests done', flush=True)


if __name__ == '__main__':
    main()
