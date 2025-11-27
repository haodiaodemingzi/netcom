#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
JS Packer解密工具
"""

import re

def unpack_js_packer(packed_js):
    """解密JS Packer混淆代码"""
    try:
        # 提取参数
        pattern = r"eval\(function\(p,a,c,k,e,d\).*?return p\}\('(.+?)',(\d+),(\d+),'(.+?)'\.split\('\|'\)"
        match = re.search(pattern, packed_js, re.DOTALL)
        if not match:
            return None
        
        p, a, c, k = match.groups()
        a, c = int(a), int(c)
        k = k.split('|')
        
        print("Parameters:", len(p), a, c, len(k))
        
        # 解密函数e的实现
        def e(c_val):
            if c_val < a:
                return ""
            else:
                return e(c_val // a) + (chr(c_val % a + 29) if c_val % a > 35 else str(c_val % a) if c_val % a < 36 else str(c_val % a))
        
        # 替换过程
        result = p
        for i in range(c - 1, -1, -1):
            if i < len(k) and k[i]:
                # 构建正则表达式
                pattern = r'\b' + e(i) + r'\b'
                result = re.sub(pattern, k[i], result)
        
        return result
    except Exception as ex:
        print("Decrypt failed:", ex)
        return None

def extract_uk_from_js(js_code):
    """从解密后的JS代码中提取uk参数"""
    try:
        # 查找uk参数
        uk_match = re.search(r'uk=([^&\'"]+)', js_code)
        if uk_match:
            return uk_match.group(1)
        
        # 如果没找到，尝试查找变量赋值
        uk_var_match = re.search(r'uk["\']?\s*[:=]\s*["\']([^"\']+)["\']', js_code)
        if uk_var_match:
            return uk_var_match.group(1)
            
        return None
    except:
        return None

if __name__ == '__main__':
    # 测试代码
    packed = '''eval(function(p,a,c,k,e,d){e=function(c){return(c<a?"":e(parseInt(c/a)))+((c=c%a)>35?String.fromCharCode(c+29):c.toString(36))};if(!''.replace(/^/,String)){while(c--)d[e(c)]=k[c]||e(c);k=[function(e){return d[e]}];e=function(){return'\\w+'};c=1;};while(c--)if(k[c])p=p.replace(new RegExp('\\b'+e(c)+'\\b','g'),k[c]);return p;}('m 8(){3 7=5;3 6=\'a\';3 9="l://k.n.q/1/p/5";3 4=["/o.2","/j.2","/c.2","/h.2","/f.2","/g.2","/b.2","/e.2","/r.2","/A.2","/z.2","/y.2","/C.2","/B.2","/x.2"];t(3 i=0;i<4.s;i++){4[i]=9+4[i]+\'?7=5&6=a&v=w\'}u 4}3 d;d=8();',39,39,'||jpg|var|pvalue|119988|key|cid|dm5imagefun|pix|72fa4e46f7f8af9dccff760f707ffe34|8_8572|4_6083||9_3065|6_2027|7_3336|5_1349||3_3170|image|https|function|xmanhua|2_1720|73|com|10_9412|length|for|return|uk|707970C804232C298A93E11EACBE370150C065E4E9D4B9A92E2CDF7209044E7F|16_5410|13_6986|12_5151|11_2808|15_6889|14_9957'.split('|'),0,{})'''
    
    print("Starting JS Packer decryption...")
    
    # 解密
    unpacked = unpack_js_packer(packed)
    if unpacked:
        print("\nDecryption successful:")
        print(unpacked)
        
        # 提取uk参数
        uk = extract_uk_from_js(unpacked)
        if uk:
            print("\nExtracted uk parameter:", uk)
        else:
            print("\nUK parameter not found")
    else:
        print("Decryption failed")
