#!/usr/bin/env python3
"""Kiểm tra chặt file .docx sinh động: cấu trúc OOXML, section, bảng, layout."""
import sys, zipfile, re, html
import xml.etree.ElementTree as ET

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
R = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'

def check(path, expect=None):
    expect = expect or {}
    errs, warns, info = [], [], {}
    z = zipfile.ZipFile(path)
    names = [n for n in z.namelist() if not n.endswith('/')]

    # 1) mọi part XML phải well-formed
    for n in names:
        if n.endswith(('.xml', '.rels')):
            try:
                ET.fromstring(z.read(n))
            except Exception as e:
                errs.append("XML hỏng %s: %s" % (n, e))
    if errs:
        return errs, warns, info

    doc = z.read('word/document.xml')
    root = ET.fromstring(doc)
    xs = doc.decode('utf8')
    txt = html.unescape(''.join(re.findall(r'<w:t[^>]*>([^<]*)</w:t>', xs)))

    # 2) content-types phủ hết part
    ct = ET.fromstring(z.read('[Content_Types].xml'))
    CT = '{http://schemas.openxmlformats.org/package/2006/content-types}'
    defaults = {d.get('Extension').lower() for d in ct.findall(CT + 'Default')}
    overrides = {o.get('PartName') for o in ct.findall(CT + 'Override')}
    for n in names:
        if n == '[Content_Types].xml':
            continue
        if ('/' + n) not in overrides and n.rsplit('.', 1)[-1].lower() not in defaults:
            errs.append("thiếu content-type: " + n)

    # 3) mọi r:id dùng trong document phải có trong rels
    rels = z.read('word/_rels/document.xml.rels').decode('utf8')
    have = set(re.findall(r'Id="(rId\d+)"', rels))
    used = set(re.findall(r'r:id="(rId\d+)"', xs)) | set(re.findall(r'r:embed="(rId\d+)"', xs))
    if used - have:
        errs.append("r:id không có trong rels: %s" % sorted(used - have))

    # 4) token/marker còn sót — soi MỌI part, không chỉ document.xml
    left = set(re.findall(r'\{\{[A-Z0-9_]+\}\}', txt))
    for n in names:
        if n.endswith('.xml') and n.startswith('word/'):
            t2 = html.unescape(''.join(re.findall(r'<w:t[^>]*>([^<]*)</w:t>', z.read(n).decode('utf8'))))
            for k in re.findall(r'\{\{[A-Z0-9_]+\}\}', t2):
                left.add(k + ' @' + n.split('/')[-1])
    if left:
        errs.append("còn token chưa thay: %s" % sorted(left))

    # 5) chuỗi lỗi lập trình lọt vào văn bản
    for bad in ('undefined', 'NaN', '[object Object]', 'null,'):
        if bad in txt:
            errs.append("văn bản chứa %r" % bad)

    # 6) BẢNG: số ô mỗi dòng phải khớp số cột của bảng
    tbl_bad = 0
    tables = root.iter(W + 'tbl')
    n_tbl = 0
    for t in tables:
        n_tbl += 1
        grid = t.find(W + 'tblGrid')
        ncol = len(grid.findall(W + 'gridCol')) if grid is not None else 0
        rows = t.findall(W + 'tr')
        if not rows:
            errs.append("bảng rỗng (0 dòng)")
            continue
        for ri, tr in enumerate(rows, 1):
            span = 0
            for tc in tr.findall(W + 'tc'):
                gs = tc.find(W + 'tcPr/' + W + 'gridSpan')
                span += int(gs.get(W + 'val')) if gs is not None else 1
            if ncol and span != ncol:
                tbl_bad += 1
                if tbl_bad <= 6:
                    head = ''.join(tr.itertext())[:48]
                    errs.append("bảng %d cột nhưng dòng %d có %d ô  [%s]" % (ncol, ri, span, head))
    info['tables'] = n_tbl
    if tbl_bad > 6:
        errs.append("... tổng %d dòng lệch số cột" % tbl_bad)

    # 7) mọi <w:tc> phải chứa ít nhất 1 <w:p> (yêu cầu của OOXML)
    empty_tc = sum(1 for tc in root.iter(W + 'tc') if tc.find(W + 'p') is None)
    if empty_tc:
        errs.append("%d ô bảng không có đoạn văn (<w:p>) — Word sẽ báo lỗi" % empty_tc)

    # 8) SECTION
    sect = re.findall(r'<w:sectPr\b', xs)
    info['sectPr'] = len(sect)
    ftr = re.findall(r'<w:footerReference[^>]*r:id="(rId\d+)"', xs)
    info['footerRef'] = len(ftr)
    if set(ftr) - have:
        errs.append("footerReference trỏ rId không tồn tại")
    # mỗi sectPr phải có pgSz
    if len(re.findall(r'<w:pgSz\b', xs)) != len(sect):
        errs.append("có sectPr thiếu <w:pgSz>")

    # 9) sectPr chỉ được nằm trong <w:pPr> hoặc cuối <w:body>
    body = root.find(W + 'body')
    tail = list(body)[-1] if len(body) else None
    n_inline = len(re.findall(r'<w:pPr>(?:(?!</w:pPr>).)*?<w:sectPr\b', xs, re.S))
    if tail is None or tail.tag != W + 'sectPr':
        errs.append("body không kết thúc bằng <w:sectPr>")
    if n_inline != len(sect) - 1:
        warns.append("sectPr lồng bất thường (inline=%d, tổng=%d)" % (n_inline, len(sect)))

    # 10) thống kê nội dung
    info['PHẦN'] = len(re.findall(r'PHẦN [IVX]+', txt))
    info['mã tài liệu'] = len(set(re.findall(r'\S+/(?:YCNT|BBNT|BBKT)/[\w-]+/\d+', txt)))
    info['PCCC'] = txt.count('YÊU CẦU RIÊNG ĐỐI VỚI THANG CHỮA CHÁY')
    info['HM bổ sung'] = txt.count('KIỂM TRA CÁC HẠNG MỤC BỔ SUNG')

    # 11) đối chiếu kỳ vọng
    for k, v in expect.items():
        if info.get(k) != v:
            errs.append("kỳ vọng %s=%s nhưng nhận %s" % (k, v, info.get(k)))
    return errs, warns, info

if __name__ == '__main__':
    import json
    path = sys.argv[1]
    exp = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}
    e, w, i = check(path, exp)
    print("== %s" % path.split('/')[-1])
    print("   " + "  ".join("%s=%s" % (k, v) for k, v in i.items()))
    for x in w: print("   warn:", x)
    for x in e: print("   ERR :", x)
    if not e: print("   ✓ ĐẠT")
    sys.exit(1 if e else 0)
