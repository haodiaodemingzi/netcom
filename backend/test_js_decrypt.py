#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
JS Packer解密测试脚本
"""

import re
import execjs

def decode_packer(packed_code):
    """解密JS Packer代码"""
    try:
        # 方法1: 直接用execjs执行
        print("Method 1: Using execjs...")
        ctx = execjs.compile("")
        # 直接执行完整的eval语句
        result1 = ctx.eval(packed_code)
        print("execjs result:", result1[:200] + "..." if len(result1) > 200 else result1)
        return result1
    except Exception as e:
        print("execjs方法失败:", e)
    
    try:
        # 方法2: 手动解析参数
        print("\n方法2: 手动解析参数...")
        
        # 提取参数 - 修复正则表达式
        pattern = r"return p\}\('(.+?)',(\d+),(\d+),'(.+?)'\.split\('\|'\)"
        match = re.search(pattern, packed_code, re.DOTALL)
        if not match:
            print("Cannot match parameters")
            print("Trying alternative pattern...")
            # 尝试另一种模式
            alt_pattern = r"eval\(function\(p,a,c,k,e,d\).*?\('(.+?)',(\d+),(\d+),'(.+?)'\.split\('\|'\)"
            match = re.search(alt_pattern, packed_code, re.DOTALL)
            if not match:
                print("Alternative pattern also failed")
                return None
        
        p, a, c, k = match.groups()
        a, c = int(a), int(c)
        k = k.split('|')
        
        print("Parameters: p_len={}, a={}, c={}, k_len={}".format(len(p), a, c, len(k)))
        print("k array first 10:", k[:10])
        print("k array last 10:", k[-10:])
        
        # 查找uk相关的token
        if 'uk' in k:
            uk_index = k.index('uk')
            print("uk at index:", uk_index)
            print("uk nearby tokens:", k[max(0, uk_index-3):uk_index+10])
        
        # 实现解密函数
        def decode_char(c_val):
            if c_val < a:
                return ""
            else:
                quotient = c_val // a
                remainder = c_val % a
                prefix = decode_char(quotient)
                if remainder > 35:
                    suffix = chr(remainder + 29)
                else:
                    suffix = str(remainder) if remainder < 36 else chr(remainder + 29)
                return prefix + suffix
        
        # 替换过程
        result = p
        replacements = 0
        for i in range(c - 1, -1, -1):
            if i < len(k) and k[i]:
                encoded = decode_char(i)
                if encoded:
                    old_result = result
                    result = re.sub(r'\b' + re.escape(encoded) + r'\b', k[i], result)
                    if result != old_result:
                        replacements += 1
                        if replacements <= 5:  # 只打印前5个替换
                            print(f"替换 '{encoded}' -> '{k[i]}'")
        
        print(f"总共进行了 {replacements} 次替换")
        print("解密结果:", result[:200] + "..." if len(result) > 200 else result)
        return result
        
    except Exception as e:
        print("手动解析失败:", e)
        return None

def extract_uk_value(js_code):
    """从解密后的JS代码中提取uk值"""
    print("\n提取uk值...")
    
    # 方法1: 查找uk=xxx
    uk_match = re.search(r'uk=([^&\'"]+)', js_code)
    if uk_match:
        uk_value = uk_match.group(1)
        print("Method 1 found uk:", uk_value)
        return uk_value
    
    # 方法2: 查找uk变量赋值
    uk_var_match = re.search(r'uk["\']?\s*[:=]\s*["\']([^"\']+)["\']', js_code)
    if uk_var_match:
        uk_value = uk_var_match.group(1)
        print("Method 2 found uk:", uk_value)
        return uk_value
    
    # 方法3: 查找长字符串（uk值通常很长）
    long_strings = re.findall(r'[A-F0-9]{40,}', js_code)
    if long_strings:
        print("Method 3 found long strings:", long_strings)
        return long_strings[0]
    
    print("UK value not found")
    return None

def extract_uk_from_tokens(packed_code):
    """直接从token数组中提取uk值"""
    print("\nMethod 4: Extract UK from tokens directly...")
    
    # 查找split('|')部分
    split_match = re.search(r"'([^']+)'\.split\('\|'\)", packed_code)
    if split_match:
        tokens = split_match.group(1).split('|')
        print("Found {} tokens".format(len(tokens)))
        
        # 查找uk和对应的值
        if 'uk' in tokens:
            uk_index = tokens.index('uk')
            print("UK at index:", uk_index)
            print("Tokens around UK:", tokens[max(0, uk_index-3):uk_index+10])
            
            # 查找长字符串（uk值）
            for i, token in enumerate(tokens):
                if len(token) > 40 and re.match(r'^[A-F0-9]+$', token):
                    print("Found UK value at index {}: {}".format(i, token))
                    return token
        
        # 如果没找到uk关键字，直接查找长字符串
        for i, token in enumerate(tokens):
            if len(token) > 40 and re.match(r'^[A-F0-9]+$', token):
                print("Found long hex string at index {}: {}".format(i, token))
                return token
    
    return None

def test_with_sample():
    """使用示例代码测试"""
    sample_code = '''function(p,a,c,k,e,d){e=function(c){return(c<a?"":e(parseInt(c/a)))+((c=c%a)>35?String.fromCharCode(c+29):c.toString(36))};if(!''.replace(/^/,String)){while(c--)d[e(c)]=k[c]||e(c);k=[function(e){return d[e]}];e=function(){return'\\w+'};c=1;};while(c--)if(k[c])p=p.replace(new RegExp('\\b'+e(c)+'\\b','g'),k[c]);return p;}('h a(){2 6=4;2 5=\'9\';2 7="g://k.j.c/1/b/4";2 3=["/f.8","/e.8"];o(2 i=0;i<3.l;i++){3[i]=7+3[i]+\'?6=4&5=9&p=n\'}m 3}2 d;d=a();',26,26,'||var|pvalue|271714|key|cid|pix|jpg|f1b83c8b2bb4fe3e38e86acb13a9d78c|dm5imagefun|73|com||2_6830|1_5473|https|function||xmanhua|image|length|return|707970C804232C298A93E11EACBE37019E2358B7C52FF35542B8225D5BD84A6F|for|uk'.split('|'),0,{})'''
    
    print("=" * 60)
    print("测试JS Packer解密")
    print("=" * 60)
    
    # 先尝试直接从token提取uk
    uk_direct = extract_uk_from_tokens(sample_code)
    if uk_direct:
        print("\nDirect UK extraction successful:", uk_direct)
        return
    
    # 解密
    decoded = decode_packer(sample_code)
    if decoded:
        print("\n" + "=" * 40)
        print("Complete decrypt result:")
        print(decoded)
        
        # 提取uk
        uk = extract_uk_value(decoded)
        if uk:
            print("\nFinal UK value:", uk)
        else:
            print("\nFailed to extract UK value")
    else:
        print("Decryption failed")

if __name__ == '__main__':
    test_with_sample()
