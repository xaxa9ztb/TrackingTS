#!/usr/bin/env python3
"""Vá Biên bản bàn giao (PHẦN X) trong hoso_chatluong_template.docx cho giống các biên bản nghiệm thu.

Việc đã làm một lần (mẫu trong repo đã được vá — file này chỉ để biết đã sửa gì và chạy lại trên bản trước đó):
  * Dòng "{{DIA_DANH}}, ngày …" đầu biên bản -> bảng header của biên bản nghiệm thu
    ({{BLOCK_HDR}} tên nhà thầu | Quốc hiệu, tiêu ngữ, địa danh – ngày).
  * Bỏ 2 bảng "Bên Mua / The Buyer" và "Bên Bán / The Seller" -> điểm chèn {{BLOCK_TP_BBG}}
    (thành phần tham gia, cùng danh sách và cách trình bày với biên bản nghiệm thu).
  * Bảng ký "ĐẠI DIỆN BÊN BÁN / ĐẠI DIỆN BÊN MUA" -> điểm chèn {{BLOCK_KY_BBG}} (khối ký các bên như biên bản nghiệm thu).

Dùng: python3 -I tools_patch_bbg.py <in.docx> <out.docx>
"""
import re, sys, zipfile

def txt(s):
    return re.sub(r'<[^>]+>', '', s)

def marker(tok):
    return '<w:p><w:r><w:t>' + tok + '</w:t></w:r></w:p>'

def patch(x):
    i, j = x.index('{{BBG_BEGIN}}'), x.index('{{BBG_END}}')
    seg = x[i:j]
    assert '{{BLOCK_TP_BBG}}' not in seg, 'mẫu đã được vá'
    # bảng header của biên bản nghiệm thu đầu tiên (sau trang bìa) — bỏ mã định danh đoạn để không trùng
    k = [m.start() for m in re.finditer(r'\{\{BLOCK_HDR\}\}', x)][2]
    hdr = x[x.rfind('<w:tbl>', 0, k):x.find('</w:tbl>', k) + 8]
    assert 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM' in hdr
    hdr = re.sub(r' w14:(paraId|textId)="[^"]*"', '', hdr).replace('<w:lastRenderedPageBreak />', '')
    # 1. dòng địa danh – ngày -> header
    d = seg.index('ngày ......... tháng')
    p0 = max(seg.rfind('<w:p>', 0, d), seg.rfind('<w:p ', 0, d))
    p1 = seg.index('</w:p>', d) + 6
    assert '<w:sectPr' not in seg[p0:p1]
    seg = seg[:p0] + hdr + '<w:p/>' + seg[p1:]
    # 2. bảng Bên Mua + Bên Bán -> thành phần tham gia
    tbs = list(re.finditer(r'<w:tbl>.*?</w:tbl>', seg, re.S))
    buy = [m for m in tbs if 'The Buyer' in txt(m.group(0)) and '{{CHU_DAU_TU_HOA}}' in m.group(0)]
    sell = [m for m in tbs if 'The Seller' in txt(m.group(0)) and '{{NHA_THAU}}' in m.group(0)]
    assert len(buy) == 1 and len(sell) == 1 and buy[0].end() <= sell[0].start()
    between = seg[buy[0].end():sell[0].start()]
    assert '<w:t' not in between or not txt(between).strip(), 'có chữ giữa 2 bảng Bên Mua / Bên Bán'
    seg = seg[:buy[0].start()] + marker('{{BLOCK_TP_BBG}}') + seg[sell[0].end():]
    # 3. bảng ký Bên Bán / Bên Mua -> khối ký các bên
    ky = [m for m in re.finditer(r'<w:tbl>.*?</w:tbl>', seg, re.S) if 'On behalf of the Seller' in txt(m.group(0))]
    assert len(ky) == 1
    seg = seg[:ky[0].start()] + marker('{{BLOCK_KY_BBG}}') + seg[ky[0].end():]
    return x[:i] + seg + x[j:]

def main(src, dst):
    zin = zipfile.ZipFile(src)
    zout = zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED)
    for it in zin.infolist():
        data = zin.read(it.filename)
        if it.filename == 'word/document.xml':
            data = patch(data.decode('utf8')).encode('utf8')
        zout.writestr(it, data)
    zout.close()

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
