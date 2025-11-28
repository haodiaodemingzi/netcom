import { Parser } from 'htmlparser2';
import { DomHandler } from 'domhandler';
import * as DomUtils from 'domutils';

/**
 * 简化的HTML解析器
 * 使用简单直接的方式查找元素
 */
class CheerioLike {
  constructor(elements, dom) {
    this.elements = Array.isArray(elements) ? elements.filter(e => e) : (elements ? [elements] : []);
    this.length = this.elements.length;
    this.dom = dom; // 保存根DOM用于全局查询
  }

  /**
   * 查找子元素
   */
  find(selector) {
    const results = [];
    this.elements.forEach(elem => {
      if (elem) {
        const found = findInElement(elem, selector);
        results.push(...found);
      }
    });
    return new CheerioLike(results, this.dom);
  }

  /**
   * 获取第一个元素
   */
  first() {
    return new CheerioLike(this.elements[0] || null, this.dom);
  }

  /**
   * 获取文本内容
   */
  text() {
    if (this.elements.length === 0 || !this.elements[0]) return '';
    return DomUtils.getText(this.elements[0]).trim();
  }

  /**
   * 获取属性
   */
  attr(name) {
    if (this.elements.length === 0 || !this.elements[0]) return '';
    const elem = this.elements[0];
    return (elem.attribs && elem.attribs[name]) || '';
  }

  /**
   * 遍历元素
   */
  each(callback) {
    this.elements.forEach((elem, index) => {
      if (elem) {
        callback(index, elem);
      }
    });
    return this;
  }

  /**
   * 检查是否有类名
   */
  hasClass(className) {
    if (this.elements.length === 0 || !this.elements[0]) return false;
    const elem = this.elements[0];
    const classes = (elem.attribs && elem.attribs.class) || '';
    return classes.split(' ').includes(className);
  }
}

/**
 * 在元素中查找匹配的子元素
 */
function findInElement(root, selector) {
  // 处理简单的选择器
  if (selector.startsWith('#')) {
    // ID选择器
    const id = selector.substring(1);
    return DomUtils.findAll(el => el.attribs && el.attribs.id === id, [root]);
  } else if (selector.startsWith('.')) {
    // 类选择器
    const className = selector.substring(1);
    return DomUtils.findAll(el => {
      return el.attribs && el.attribs.class && el.attribs.class.split(' ').includes(className);
    }, [root]);
  } else if (selector.includes('.')) {
    // tag.class 选择器
    const [tag, className] = selector.split('.');
    return DomUtils.findAll(el => {
      return el.name === tag && el.attribs && el.attribs.class && el.attribs.class.split(' ').includes(className);
    }, [root]);
  } else if (selector.includes(' > ')) {
    // 直接子元素选择器 (例如: ul.mh-list > li)
    const parts = selector.split(/\s*>\s*/);
    let current = [root];
    
    parts.forEach((part, idx) => {
      const next = [];
      current.forEach(elem => {
        if (idx === 0) {
          // 第一部分：在整个树中查找
          next.push(...findInElement(elem, part));
        } else {
          // 后续部分：只在直接子元素中查找
          if (elem.children) {
            elem.children.forEach(child => {
              if (child.type === 'tag' && matchSelector(child, part)) {
                next.push(child);
              }
            });
          }
        }
      });
      current = next;
    });
    
    return current;
  } else if (selector.includes(' ')) {
    // 后代选择器 (例如: div a)
    const parts = selector.split(/\s+/);
    let current = [root];
    parts.forEach(part => {
      const next = [];
      current.forEach(elem => {
        next.push(...findInElement(elem, part));
      });
      current = next;
    });
    return current;
  } else {
    // 标签选择器
    return DomUtils.findAll(el => el.name === selector, [root]);
  }
}

/**
 * 检查元素是否匹配选择器
 */
function matchSelector(elem, selector) {
  if (!elem || !elem.name) return false;
  
  if (selector.includes('.')) {
    const [tag, className] = selector.split('.');
    return elem.name === tag && elem.attribs && elem.attribs.class && elem.attribs.class.split(' ').includes(className);
  } else if (selector.startsWith('.')) {
    const className = selector.substring(1);
    return elem.attribs && elem.attribs.class && elem.attribs.class.split(' ').includes(className);
  } else {
    return elem.name === selector;
  }
}

/**
 * 主解析函数 (模拟cheerio.load)
 */
export function load(html) {
  const handler = new DomHandler();
  const parser = new Parser(handler);
  parser.write(html);
  parser.end();
  const dom = handler.dom;

  // 返回类似cheerio的$函数
  return function $(selector) {
    if (!selector) {
      return new CheerioLike(dom, dom);
    }
    // 如果selector是一个元素对象，直接包装
    if (typeof selector === 'object' && selector.type) {
      return new CheerioLike(selector, dom);
    }
    // 从根DOM查找
    const results = [];
    dom.forEach(root => {
      results.push(...findInElement(root, selector));
    });
    return new CheerioLike(results, dom);
  };
}

export { CheerioLike };
