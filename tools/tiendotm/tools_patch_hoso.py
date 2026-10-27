#!/usr/bin/env python3
"""Vá mẫu hoso_chatluong_template.docx để các nội dung tuỳ chọn do mã (index.html) quyết định.

Việc đã làm một lần (mẫu trong repo đã được vá — file này chỉ để biết đã sửa gì và chạy lại trên bản gốc):
  * Biên bản kiểm tra Phần I (vật liệu đầu vào): bỏ nhóm “IV. Vật tư sản xuất trong nước / 22. Đà thép…” cố định,
    thay bằng điểm chèn {{BLOCK_KT_HM}} (hạng mục bổ sung do người dùng khai ở mục D2).
  * Biên bản kiểm tra Phần II (lắp đặt tĩnh): bỏ nhóm “II. Hệ đà thép…” và các dòng 5–10 cố định;
    nhóm “III. Lắp đặt tĩnh…” thành “II.”. (Số thứ tự dòng được đánh lại khi xuất.)
  * Biên bản kiểm tra Phần VII: dòng “Khối lượng …” lấy từ {{KL_TEN}} / {{KL_SPEC}} thay vì số lượng đà thép cố định.
  * Mục II “Căn cứ pháp lý”: bỏ 7 tiêu chuẩn gõ sẵn (bị lặp với danh sách {{BLOCK_TCAD}} do mã sinh).
  * Phần I mục II “Hồ sơ hàng hóa”: thêm {{XUAT_XU}}, {{CT_COCQ}}, {{CT_VANDON}}, {{CT_GIAMDINH}}, {{CT_TOKHAI}}
    để điền số chứng từ hàng hoá (C/O, C/Q, HBL, Packing List, chứng thư giám định, tờ khai).

Dùng: python3 -I tools_patch_hoso.py <in.docx> <out.docx>
"""
import re, sys, zipfile

def txt(s):
    return re.sub(r'<[^>]+>', '', s)

def rows(t):
    return re.findall(r'<w:tr\b.*?</w:tr>', t, re.S)

def first_cell_text(r):
    m = re.search(r'<w:tc>.*?</w:tc>', r, re.S)
    return txt(m.group(0)).strip() if m else ''

def patch_bbg(x):
    """Biên bản bàn giao (PHẦN X) theo mẫu mới: Bên Mua / Bên Bán, số HĐ kèm phụ lục (mã sẽ bỏ nếu không có phụ lục)."""
    i, j = x.index('{{BBG_BEGIN}}'), x.index('{{BBG_END}}')
    seg = x[i:j]
    seg = seg.replace('>Chủ đầu tư<', '>Bên Mua<', 1)
    # bỏ bảng “Nhà thầu / The Contractor” (trùng với Bên Bán) cùng đoạn đệm rỗng ngay sau nó
    tbs = [m for m in re.finditer(r'<w:tbl>.*?</w:tbl>(?:<w:p>(?:(?!<w:t[ >])(?!</w:p>).)*</w:p>)?', seg, re.S) if 'The Contractor' in m.group(0)]
    assert len(tbs) == 1, 'BBG: không thấy bảng Nhà thầu/The Contractor'
    seg = seg[:tbs[0].start()] + seg[tbs[0].end():]
    assert '>Nhà cung cấp<' in seg and '>The Supplier<' in seg
    seg = seg.replace('>Nhà cung cấp<', '>Bên Bán<', 1).replace('>The Supplier<', '>The Seller<', 1)
    assert '>{{SO_HD}}<' in seg
    seg = seg.replace('>{{SO_HD}}<', '>{{SO_HD}} và Phụ lục Hợp đồng số {{SO_PL}}<', 1)
    bad = 'Khác / Others: {{BBG_TRAVEL}}{{BBG_TRAVEL}}{{BBG_TRAVEL}}.....'
    assert bad in seg
    seg = seg.replace(bad, 'Khác / Others: ' + '.' * 59)
    return x[:i] + seg + x[j:]

def drop_static_tc(x):
    """Mục II “Căn cứ pháp lý”: mẫu cũ có sẵn 7 tiêu chuẩn chung rồi {{BLOCK_TCAD}} lại sinh lại đủ danh sách
    (gồm cả 7 mục đó) nên bị lặp. Bỏ 7 dòng gõ sẵn, giữ lại danh sách do mã sinh theo loại thiết bị."""
    h = x.index('II. Căn cứ pháp lý và tiêu chuẩn áp dụng')
    h_end = x.index('</w:p>', h) + 6
    b = x.index('{{BLOCK_TCAD}}')
    b_start = x.rindex('<w:p>', 0, b) if x.rfind('<w:p>', 0, b) > h_end else x.rindex('<w:p ', 0, b)
    mid = x[h_end:b_start]
    paras = re.findall(r'<w:p\b.*?</w:p>', mid, re.S)
    assert len(paras) == 7 and ''.join(paras) == mid, 'mục II: không đúng 7 dòng gõ sẵn (%d)' % len(paras)
    return x[:h_end] + x[b_start:]

def patch(x):
    x = drop_static_tc(patch_bbg(x))
    tbls = [(m.start(), m.end()) for m in re.finditer(r'<w:tbl>.*?</w:tbl>', x, re.S)]
    out, last = [], 0
    hm_row = None
    for a, b in tbls:                     # lấy dòng mẫu {{BLOCK_KT_HM}} có sẵn ở bảng Phần II
        t = x[a:b]
        if '{{BLOCK_KT_HM}}' in t:
            hm_row = [r for r in rows(t) if '{{BLOCK_KT_HM}}' in r][0]
    assert hm_row, 'không thấy dòng {{BLOCK_KT_HM}} trong mẫu'
    n_done = {'I': 0, 'II': 0, 'VII': 0}
    for a, b in tbls:
        t = x[a:b]
        nt = t
        if 'Thiết bị, dụng cụ tháo dỡ thùng hàng' in t:            # bảng kiểm tra Phần I
            rs = rows(t)
            drop = [r for r in rs if first_cell_text(r) in ('IV. Vật tư sản xuất trong nước', '22')]
            assert len(drop) == 2, 'Phần I: không đúng 2 dòng cần bỏ'
            for r in drop:
                nt = nt.replace(r, '')
            nt = nt.replace('</w:tbl>', hm_row + '</w:tbl>')
            for r in rs:                                             # số chứng từ hàng hoá
                k = first_cell_text(r)
                add = {
                    '6': ('xuất xứ Trung Quốc, sản xuất bởi nhà máy chính hãng {{NHA_SX}}',
                          'xuất xứ {{XUAT_XU}}, sản xuất bởi nhà máy chính hãng {{NHA_SX}}. {{CT_COCQ}}'),
                    '7': ('Khớp số kiện, số hiệu và khối lượng hàng hóa', 'Khớp số kiện, số hiệu và khối lượng hàng hóa. {{CT_VANDON}}'),
                    '8': ('Bản gốc; đúng chủng loại và nguồn gốc xuất xứ thang máy', 'Bản gốc; đúng chủng loại và nguồn gốc xuất xứ thang máy. {{CT_GIAMDINH}}'),
                    '9': ('Đầy đủ theo Điều 3 Hợp đồng', 'Đầy đủ theo Điều 3 Hợp đồng. {{CT_TOKHAI}}'),
                }.get(k)
                if add:
                    assert add[0] in r, 'Phần I dòng %s: không thấy câu cần thay' % k
                    nt = nt.replace(r, r.replace(add[0], add[1]))
            n_done['I'] += 1
        elif '{{BLOCK_KT_HM}}' in t and 'Ray dẫn hướng cabin và ray đối trọng' in t:   # bảng kiểm tra Phần II
            rs = rows(t)
            drop = [r for r in rs if first_cell_text(r).startswith('II. Hệ đà thép') or first_cell_text(r) in ('5', '6', '7', '8', '9', '10')]
            assert len(drop) == 7, 'Phần II: tìm thấy %d dòng đà thép (cần 7)' % len(drop)
            for r in drop:
                nt = nt.replace(r, '')
            assert 'III. Lắp đặt tĩnh thiết bị thang máy' in nt
            nt = nt.replace('III. Lắp đặt tĩnh thiết bị thang máy', 'II. Lắp đặt tĩnh thiết bị thang máy')
            n_done['II'] += 1
        elif 'Khối lượng thang máy {{DS_THANG}} và các hạng mục phát sinh theo PLHĐ số {{SO_PL}}' in t:   # Phần VII
            old1 = 'Khối lượng thang máy {{DS_THANG}} và các hạng mục phát sinh theo PLHĐ số {{SO_PL}}'
            old2 = '02 thang {{NHA_SX}} 3000; 14 đà thép; 20 bản mã gối đôn; 05 bộ dầm thép U120x55x900'
            assert old2 in t
            nt = nt.replace(old1, '{{KL_TEN}}').replace(old2, '{{KL_SPEC}}')
            n_done['VII'] += 1
        out.append(x[last:a]); out.append(nt); last = b
    out.append(x[last:])
    assert n_done == {'I': 1, 'II': 1, 'VII': 1}, n_done
    return ''.join(out)

def main(src, dst):
    zi = zipfile.ZipFile(src)
    zo = zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED)
    for it in zi.infolist():
        data = zi.read(it.filename)
        if it.filename == 'word/document.xml':
            data = patch(data.decode('utf8')).encode('utf8')
        zo.writestr(it, data)
    zo.close()

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
