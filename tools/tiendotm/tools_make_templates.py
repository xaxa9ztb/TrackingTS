#!/usr/bin/env python3
"""Tạo 3 file mẫu có {{TOKEN}} từ 3 mẫu Word gốc (mẫu do người dùng cung cấp).

  nhatky_template.docx          <- Mẫu nhật ký thi công xây dựng công trình (NĐ 06/2021 / 207)
  bbxn_hangve_template.docx     <- BBXN thiết bị đến công trường (file .doc đã đổi sang .docx bằng LibreOffice)
  bangiao_template.docx         <- Biên bản bàn giao thang máy (song ngữ)

Dùng: python3 -I tools_make_templates.py <nhatky.docx> <bbxn.docx> <bangiao.docx> <thư mục ra>
Mã (index.html) thay token và nhân bản khối ngày của nhật ký; xem exportNhatKy / exportBBXN / exportBanGiao.
"""
import re, sys, zipfile, os, unicodedata

PAR = re.compile(r'<w:p\b[^>]*>.*?</w:p>', re.S)
RUN = re.compile(r'<w:r\b[^>]*>.*?</w:r>', re.S)

def ptext(p):
    return re.sub(r'<[^>]+>', '', p)

def esc(t):
    return t.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')

def set_par_text(p, text, tabs=None):
    """Thay toàn bộ chữ của đoạn bằng `text` (giữ pPr và định dạng của run chữ đầu tiên). '\\t' -> tab."""
    runs = list(RUN.finditer(p))
    textual = [m for m in runs if '<w:t' in m.group(0)]
    assert textual, 'đoạn không có chữ: ' + ptext(p)[:60]
    first = textual[0].group(0)
    rpr = re.search(r'<w:rPr>.*?</w:rPr>', first, re.S)
    rpr = rpr.group(0) if rpr else ''
    parts = []
    for i, seg in enumerate(text.split('\t')):
        if i:
            parts.append('<w:r>%s<w:tab/></w:r>' % rpr)
        if seg:
            parts.append('<w:r>%s<w:t xml:space="preserve">%s</w:t></w:r>' % (rpr, esc(seg)))
    new = ''.join(parts)
    out, last, placed = [], 0, False
    for m in textual:
        out.append(p[last:m.start()])
        if not placed:
            out.append(new); placed = True
        last = m.end()
    out.append(p[last:])
    res = ''.join(out)
    if tabs:
        stops = ''.join('<w:tab w:val="left" w:pos="%d"/>' % t for t in tabs)
        if '<w:tabs>' in res:
            res = re.sub(r'<w:tabs>.*?</w:tabs>', '<w:tabs>%s</w:tabs>' % stops, res, count=1, flags=re.S)
        else:
            res = res.replace('<w:pPr>', '<w:pPr><w:tabs>%s</w:tabs>' % stops, 1) if '<w:pPr>' in res else res.replace('>', '><w:pPr><w:tabs>%s</w:tabs></w:pPr>' % stops, 1)
    return res

def apply_rules(xml, rules):
    """rules: [(regex trên chữ đoạn, chữ mới | callable(old)->chữ, lần xuất hiện thứ n (0,1,..) hoặc None = mọi lần)]. Mỗi quy tắc phải dùng được."""
    used = [0] * len(rules)
    cnt = {}                       # số lần đã gặp đoạn khớp từng regex (chung cho các quy tắc cùng regex)
    def sub(m):
        p = m.group(0)
        t = unicodedata.normalize('NFC', ptext(p)).strip()   # mẫu Word đôi khi lưu chữ có dấu dạng tổ hợp
        k_of = {}
        for rx in {r[0] for r in rules}:
            if re.search(rx, t):
                k_of[rx] = cnt.get(rx, 0)
        for rx, k in k_of.items():
            cnt[rx] = k + 1
        for i, (rx, new, nth) in enumerate(rules):
            if rx in k_of and (nth is None or nth == k_of[rx]):
                used[i] += 1
                kw = {}
                if isinstance(new, tuple):
                    new, kw = new[0], {'tabs': new[1]}
                return set_par_text(p, new(t) if callable(new) else new, **kw)
        return p
    out = PAR.sub(sub, xml)
    for i, (rx, new, nth) in enumerate(rules):
        assert used[i], 'quy tắc không khớp đoạn nào: ' + rx
    return out

def rewrite(src, dst, fn, extra=None):
    zi = zipfile.ZipFile(src)
    zo = zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED)
    for it in zi.infolist():
        data = zi.read(it.filename)
        if it.filename == 'word/document.xml':
            data = fn(data.decode('utf8')).encode('utf8')
        elif extra and it.filename in extra:
            data = extra[it.filename](data.decode('utf8')).encode('utf8')
        zo.writestr(it, data)
    zo.close()

# ---------------------------------------------------------------- BB bàn giao thang máy
def bangiao(x):
    rules = [
        (r'^Hà\s*Nội,\s*ngày', '{{DIA_DANH}}, ngày ......... tháng ......... năm 20......', None),
        (r'^VĂN PHÒNG', '{{CONG_TRINH_HOA}}', None),
        (r'^20884/SCH', '{{SO_HD}} và Phụ lục Hợp đồng số {{SO_PL}}', None),
        (r'^547 Lạc', '{{DIA_DIEM}}', None),
        (r'^ÔNG TRẦN', '{{CHU_DAU_TU_HOA}}', None),
        (r'^Số 2 Km6', '{{CDT_DIACHI}}', None),
        (r'^001059004975', '{{CDT_GIAYTO}}', None),
        (r'^84 243', '{{CDT_DIENTHOAI}}', None),
        (r'^Ông\s*Trần', '{{CDT_DAIDIEN}}', None),
        (r'^Chi Nhánh Công Ty TNHH Schindler', '{{NHA_THAU}}', None),
        (r'^Phòng 03', '{{NT_DIACHI}}', None),
        (r'^Tel: 024', '{{NT_LIENHE}}', None),
        (r'^Đại\s*diện:\s*Ông\s*Nguyễn', 'Đại diện: Ông {{NT_DAIDIEN}} – {{NT_CHUCVU}}', None),
        (r'^1\.\s*Tên thiết bị bàn giao', '1.  Tên thiết bị bàn giao: {{BBG_TENTB}}', None),
        (r'^Equipment will be handed over', 'Equipment will be handed over: {{BBG_TENTB_EN}}', None),
        (r'^2\.\s*Số lượng', '2.  Số lượng: {{BBG_SL}}', None),
        (r'^Quantity:', 'Quantity: {{BBG_SL}}', None),
        (r'^Schindler 3000$', '{{BBG_MODEL}}', None),
        (r'^13$', '{{BBG_STOPS}}', None),
        (r'^1\.75$', '{{BBG_SPEED}}', None),
        (r'^900$', '{{BBG_LOAD}}', None),
        (r'^4\.\s*Thời gian bảo hành', '4.  Thời gian bảo hành và bảo trì miễn phí: {{BBG_BH}}.', None),
        (r'^Warranty and free maintenance period', 'Warranty and free maintenance period: {{BBG_BH_EN}}.', None),
    ]
    return apply_rules(x, rules)

def footer_fix(x):
    assert '03/BBBG/20884-SCH-PL2' in x
    return x.replace('03/BBBG/20884-SCH-PL2', '{{SO_BB}}')

# ---------------------------------------------------------------- BBXN thiết bị đến công trường
def bbxn(x):
    T = 4800   # vị trí tab "Chức vụ"
    rules = [
        (r'^[….]+\s*,\s*ngày', '{{DIA_DANH}}, {{BX_NGAY_LAP}}', None),
        (r'^Công trình\s*:', '   Công trình :   {{CONG_TRINH}}', None),
        (r'^Hạng mục\s*:', '   Hạng mục :  {{HANG_MUC}}', None),
        (r'^Địa chỉ\s*:', '   Địa chỉ:        {{DIA_DIEM}}', None),
        (r'^Hợp đồng số\s*:', '   Hợp đồng số: {{SO_HD}} và Phụ lục Hợp đồng số {{SO_PL}}', None),
        (r'^- Bắt đầu', ' - Bắt đầu: vào lúc …….. giờ……  phút, {{BX_NGAY}}', None),
        (r'^- Kết thúc', ' - Kết thúc: vào lúc …….. giờ……  phút, {{BX_NGAY}}', None),
        (r'^- Tại', ' - Tại:  {{CONG_TRINH}}', None),
        (r'^Đại diện Chủ đầu tư:', ' Đại diện Chủ đầu tư: {{CHU_DAU_TU}}', None),
        (r'^Ông/Bà\s*:', ('    Ông/Bà : {{BX_CDT1_N}}\tChức vụ: {{BX_CDT1_C}}', [T]), 0),
        (r'^Ông/Bà\s*:', ('    Ông/Bà : {{BX_CDT2_N}}\tChức vụ: {{BX_CDT2_C}}', [T]), 1),
        (r'^Đại diện Nhà thầu\s*:', '  Đại diện Nhà thầu : {{NHA_THAU_HOA}}', None),
        (r'^Ông: Lại Xuân Hóa', ('    Ông: {{BX_NT1_N}}\tChức vụ: {{BX_NT1_C}}', [T]), None),
        (r'^Ông: Nguyễn Tiến Dũng', ('    Ông: {{BX_NT2_N}}\tChức vụ: {{BX_NT2_C}}', [T]), None),
        (r'^-\s*Vận đơn hàng hóa', '-   Vận đơn hàng hóa (HBL) số {{BX_HBL}}', None),
        (r'^-\s*Danh mục hàng hóa', '-   Danh mục hàng hóa (Packing List – bản sao) số {{BX_PL}}', None),
        (r'^-\s*Xuất xứ hàng hóa', '-   Xuất xứ hàng hóa (Certificate of Origin – bản sao) số {{BX_CO}}', None),
        (r'^-\s*Chứng chỉ chất lượng', '-   Chứng chỉ chất lượng (Certificate of Quality – bản sao) số {{BX_CQ}}', None),
        (r'^- Chi nhánh Công ty TNHH Schindler', '- {{NHA_THAU}} đã nhập toàn bộ thiết bị vật tư của {{BX_SL}} thang máy theo hợp đồng để lắp đặt.', None),
        (r'^-\s*Tổng số kiện', '-   Tổng số kiện hàng nhập vào công trình là {{BX_KIEN}} kiện.', None),
        (r'^Đại diện Chủ đầu tư\s+Đại diện Schindler', ('                   Đại diện Chủ đầu tư\tĐại diện Nhà thầu', [5400]), None),
    ]
    return apply_rules(x, rules)

# ---------------------------------------------------------------- Nhật ký thi công
def nhatky(x):
    D = lambda lab, tok: lab + ' ' + tok
    rules = [
        (r'^CÔNG TY$', '\t\t{{NHA_THAU_HOA}}', None),
        (r'^Địa chỉ$', '\t\tĐịa chỉ: {{NT_DIACHI}}', None),
        (r'^SĐT$', '\t\tSĐT: {{NT_LIENHE}}', None),
        (r'^QUYỂN SỐ:', 'QUYỂN SỐ: {{NK_QUYEN}}', None),
        (r'^TÊN HẠNG MỤC CÔNG TRÌNH, CÔNG TRÌNH XÂY DỰNG', 'TÊN HẠNG MỤC CÔNG TRÌNH, CÔNG TRÌNH XÂY DỰNG: {{HANG_MUC}}', None),
        (r'^THUỘC DỰ ÁN', 'THUỘC DỰ ÁN: {{CONG_TRINH}}', None),
        (r'^MÃ ĐỊNH DANH DỰ ÁN', 'MÃ ĐỊNH DANH DỰ ÁN: {{NK_MADA}}', None),
        (r'^MÃ ĐỊNH DANH CÔNG TRÌNH XÂY DỰNG', 'MÃ ĐỊNH DANH CÔNG TRÌNH XÂY DỰNG: {{NK_MACT}}', None),
        (r'^ĐỊA ĐIỂM XÂY DỰNG', 'ĐỊA ĐIỂM XÂY DỰNG: {{DIA_DIEM}}', None),
        (r'^TÊN VÀ ĐỊA CHỈ CỦA CHỦ ĐẦU TƯ', 'TÊN VÀ ĐỊA CHỈ CỦA CHỦ ĐẦU TƯ: {{CHU_DAU_TU}} – {{CDT_DIACHI}}', None),
        (r'^ĐƠN VỊ THI CÔNG$', 'ĐƠN VỊ THI CÔNG: {{NHA_THAU}}', 0),
        (r'^\.\.\.,\s*ngày', '{{DIA_DANH}}, ngày ... tháng ... năm {{NAM}}', None),
        (r'^1\. Tên hạng mục công trình', '1. Tên hạng mục công trình, công trình xây dựng: {{HANG_MUC}} thuộc dự án {{CONG_TRINH}}', None),
        (r'^2\. Mã định danh dự án', '2. Mã định danh dự án {{NK_MADA}}. Mã định danh công trình xây dựng {{NK_MACT}}', None),
        (r'^3\. Địa điểm xây dựng', '3. Địa điểm xây dựng: {{DIA_DIEM}}', None),
        (r'^4\. Tên và địa chỉ của chủ đầu tư', '4. Tên và địa chỉ của chủ đầu tư: {{CHU_DAU_TU}} – {{CDT_DIACHI}}', None),
        (r'^5\. Tên và số điện thoại liên lạc', '5. Tên và số điện thoại liên lạc của cá nhân phụ trách trực tiếp: {{NK_PHUTRACH}}', None),
        (r'^6\. Nhà thầu tư vấn giám sát', '6. Nhà thầu tư vấn giám sát thi công xây dựng công trình: {{TVGS}}', None),
        (r'^Họ và tên kỹ sư giám sát', '\tHọ và tên kỹ sư giám sát: {{NK_GS_TEN}}', None),
        (r'^Điện thoại:', '\tĐiện thoại: {{NK_GS_DT}}', 0),
        (r'^ĐƠN VỊ THI CÔNG$', '\t{{NHA_THAU}}', 1),
        (r'^Họ và tên Chỉ huy trưởng', '\tHọ và tên Chỉ huy trưởng công trường: {{NK_CHT_TEN}}', None),
        (r'^Điện thoại:', '\tĐiện thoại: {{NK_CHT_DT}}', 1),
        (r'^8\. Tên nhà thầu thiết kế', '8. Tên nhà thầu thiết kế kỹ thuật, thiết kế bản vẽ thi công: {{NK_TK}}', None),
        (r'^Họ và tên kiến trúc sư', '\tHọ và tên kiến trúc sư chủ trì: {{NK_KTS}}', None),
        (r'^Họ và tên kỹ sư chủ trì', '\tHọ và tên kỹ sư chủ trì: {{NK_KS}}', None),
        (r'^Khởi công theo hợp đồng', '\tKhởi công theo hợp đồng ngày {{NK_KC_HD}}     Thực tế {{NK_KC_TT}}', None),
        (r'^Bàn giao theo hợp đồng', '\tBàn giao theo hợp đồng ngày {{NK_BG_HD}}     Thực tế {{NK_BG_TT}}', None),
    ]
    x = apply_rules(x, rules)
    # bìa: tên đơn vị / địa chỉ dài hơn mẫu -> bớt 3 đoạn trống trước dòng ngày để dòng ngày không tràn sang trang 2
    pars = list(PAR.finditer(x))
    di = [i for i, m in enumerate(pars) if '{{DIA_DANH}}, ngày ... tháng ... năm {{NAM}}' in m.group(0)][0]
    blanks = []
    j = di - 1
    while j >= 0 and not ptext(pars[j].group(0)).strip() and len(blanks) < 3:
        blanks.append(pars[j]); j -= 1
    assert len(blanks) == 3
    for m in blanks:          # xoá từ cuối lên để vị trí không lệch
        x = x[:m.start()] + x[m.end():]
    # ĐƠN VỊ THI CÔNG ở trang thông tin (đoạn thứ 2) vốn chỉ là chỗ trống để ghi tên đơn vị -> đã có ở mục 7
    # bảng cán bộ: 4 dòng đầu mang token để mã điền từ danh sách người của nhà thầu
    tb = re.search(r'BẢNG DANH SÁCH CÁN BỘ.*?(<w:tbl>.*?</w:tbl>)', x, re.S)
    assert tb, 'không thấy bảng cán bộ'
    t = tb.group(1)
    rows = list(re.finditer(r'<w:tr\b.*?</w:tr>', t, re.S))
    new_t, last = [], 0
    for ri, m in enumerate(rows):
        new_t.append(t[last:m.start()]); last = m.end()
        r = m.group(0)
        if 1 <= ri <= 4:
            cells = list(re.finditer(r'<w:tc>.*?</w:tc>', r, re.S))
            out, l2 = [], 0
            for ci, c in enumerate(cells[:4]):
                out.append(r[l2:c.start()]); l2 = c.end()
                cell = c.group(0)
                tok = '{{NK_CB%d_%s}}' % (ri, ['TEN', 'CV', 'NV', 'DT'][ci])
                ps = list(re.finditer(r'<w:p\b[^>]*>.*?</w:p>', cell, re.S))
                p0 = ps[0].group(0)
                if '<w:t' in p0:
                    p0n = set_par_text(p0, tok)
                else:    # ô trống: dùng định dạng ký tự của dấu đoạn (pPr/rPr) để dòng không cao hơn mẫu
                    mk = re.search(r'<w:pPr>.*?(<w:rPr>.*?</w:rPr>).*?</w:pPr>', p0, re.S)
                    rpr = mk.group(1) if mk else ''
                    p0n = p0[:-6] + '<w:r>%s<w:t>%s</w:t></w:r></w:p>' % (rpr, tok)
                out.append(cell.replace(p0, p0n, 1))
            out.append(r[l2:])
            r = ''.join(out)
        new_t.append(r)
    new_t.append(t[last:])
    x = x.replace(t, ''.join(new_t), 1)
    # khối ngày: mẫu có 2 trang nhật ký -> giữ trang đầu làm khối lặp giữa hai mốc, bỏ trang thứ 2
    pars = list(PAR.finditer(x))
    dayhdrs = [i for i, m in enumerate(pars) if re.match(r'^Ngày\s*\.{3,}\s*tháng', ptext(m.group(0)).strip())]
    assert len(dayhdrs) == 3, 'số tiêu đề "Ngày …" = %d (cần 3: ký xác nhận + 2 trang nhật ký)' % len(dayhdrs)
    a = pars[dayhdrs[1]].start()
    pb = [i for i, m in enumerate(pars) if i > dayhdrs[1] and 'w:type="page"' in m.group(0)][0]
    day = x[a:pars[pb].start()]
    first_par = PAR.search(day)
    day = day.replace(first_par.group(0), set_par_text(first_par.group(0), '{{NK_NGAY}}'), 1)
    end = x.rindex('<w:sectPr')
    x = (x[:a] + '<w:p><w:r><w:t>{{NK_DAY_BEGIN}}</w:t></w:r></w:p>' + day
         + '<w:p><w:r><w:t>{{NK_DAY_END}}</w:t></w:r></w:p>' + x[end:])
    return x

def main(nk, bx, bg, out):
    os.makedirs(out, exist_ok=True)
    rewrite(nk, os.path.join(out, 'nhatky_template.docx'), nhatky)
    rewrite(bx, os.path.join(out, 'bbxn_hangve_template.docx'), bbxn)
    rewrite(bg, os.path.join(out, 'bangiao_template.docx'), bangiao, {'word/footer2.xml': footer_fix})

if __name__ == '__main__':
    main(*sys.argv[1:5])
