import 'package:equatable/equatable.dart';

/// 市场数据源模型
class MarketSource extends Equatable {
  const MarketSource({
    required this.id,
    required this.name,
    required this.description,
    required this.url,
    required this.icon,
    required this.category,
    required this.tags,
    required this.enabled,
    required this.version,
    required this.author,
    this.baseUrl,
    this.proxy,
    this.siteRules,
  });

  final String id;
  final String name;
  final String description;
  final String url;
  final String icon;
  final String category; // video, comic, ebook, novel, news
  final List<String> tags;
  final bool enabled;
  final String version;
  final String author;
  final String? baseUrl;
  final ProxyConfig? proxy;
  final SiteRules? siteRules;

  /// 判断是否已安装
  bool isInstalled(Map<String, List<String>> installedSources) {
    final categorySources = installedSources[category];
    return categorySources?.contains(id) ?? false;
  }

  factory MarketSource.fromJson(Map<String, dynamic> json) {
    return MarketSource(
      id: json['id'] as String,
      name: json['name'] as String,
      description: json['description'] as String? ?? '',
      url: json['url'] as String,
      icon: json['icon'] as String? ?? '',
      category: json['category'] as String? ?? 'comic',
      tags: (json['tags'] as List?)?.cast<String>() ?? [],
      enabled: json['enabled'] as bool? ?? true,
      version: json['version'] as String? ?? '1.0.0',
      author: json['author'] as String? ?? '',
      baseUrl: json['base_url'] as String?,
      proxy: json['proxy'] != null
          ? ProxyConfig.fromJson(json['proxy'] as Map<String, dynamic>)
          : null,
      siteRules: json['site_rules'] != null
          ? SiteRules.fromJson(json['site_rules'] as Map<String, dynamic>)
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'description': description,
      'url': url,
      'icon': icon,
      'category': category,
      'tags': tags,
      'enabled': enabled,
      'version': version,
      'author': author,
      'base_url': baseUrl,
      'proxy': proxy?.toJson(),
      'site_rules': siteRules?.toJson(),
    };
  }

  MarketSource copyWith({
    String? id,
    String? name,
    String? description,
    String? url,
    String? icon,
    String? category,
    List<String>? tags,
    bool? enabled,
    String? version,
    String? author,
    String? baseUrl,
    ProxyConfig? proxy,
    SiteRules? siteRules,
  }) {
    return MarketSource(
      id: id ?? this.id,
      name: name ?? this.name,
      description: description ?? this.description,
      url: url ?? this.url,
      icon: icon ?? this.icon,
      category: category ?? this.category,
      tags: tags ?? this.tags,
      enabled: enabled ?? this.enabled,
      version: version ?? this.version,
      author: author ?? this.author,
      baseUrl: baseUrl ?? this.baseUrl,
      proxy: proxy ?? this.proxy,
      siteRules: siteRules ?? this.siteRules,
    );
  }

  @override
  List<Object?> get props => [id, name, category];
}

/// 市场分类模型
class MarketCategory extends Equatable {
  const MarketCategory({
    required this.id,
    required this.name,
    required this.icon,
  });

  final String id;
  final String name;
  final String icon; // emoji

  factory MarketCategory.fromJson(Map<String, dynamic> json) {
    return MarketCategory(
      id: json['id'] as String,
      name: json['name'] as String,
      icon: json['icon'] as String? ?? '📦',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'icon': icon,
    };
  }

  @override
  List<Object?> get props => [id];
}

/// 市场响应模型
class MarketResponse {
  const MarketResponse({
    required this.sources,
    required this.categories,
  });

  final List<MarketSource> sources;
  final List<MarketCategory> categories;

  factory MarketResponse.fromJson(Map<String, dynamic> json) {
    return MarketResponse(
      sources: (json['sources'] as List?)
              ?.map((e) => MarketSource.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      categories: (json['categories'] as List?)
              ?.map((e) => MarketCategory.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }
}

/// 代理配置模型
class ProxyConfig extends Equatable {
  const ProxyConfig({
    required this.enabled,
    required this.host,
    required this.port,
    required this.type,
  });

  final bool enabled;
  final String host;
  final int port;
  final String type;

  factory ProxyConfig.fromJson(Map<String, dynamic> json) {
    return ProxyConfig(
      enabled: json['enabled'] as bool? ?? false,
      host: json['host'] as String? ?? '127.0.0.1',
      port: json['port'] as int? ?? 7897,
      type: json['type'] as String? ?? 'http',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'enabled': enabled,
      'host': host,
      'port': port,
      'type': type,
    };
  }

  @override
  List<Object?> get props => [enabled, host, port, type];
}

/// 站点规则模型（用于 BBS 小说等）
class SiteRules extends Equatable {
  const SiteRules({
    required this.categoryEntryUrl,
    required this.categoryGroup,
  });

  final String categoryEntryUrl;
  final String categoryGroup;

  factory SiteRules.fromJson(Map<String, dynamic> json) {
    return SiteRules(
      categoryEntryUrl: json['category_entry_url'] as String? ?? '',
      categoryGroup: json['category_group'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'category_entry_url': categoryEntryUrl,
      'category_group': categoryGroup,
    };
  }

  @override
  List<Object?> get props => [categoryEntryUrl, categoryGroup];
}
