"""Extract selected unchanged provisions from the downloaded official 168 HTML.

Usage: python scripts/extract-penalty-excerpts.py data/work/penalty-source
Requires lxml. Extraction does not grant publication approval.
"""
import hashlib
import json
import re
import sys
from pathlib import Path
from lxml import html

ROOT = Path(__file__).resolve().parent.parent
URL = 'https://xaydungchinhsach.chinhphu.vn/toan-van-nghi-dinh-168-2024-nd-cp-quy-dinh-xu-phat-vi-pham-hanh-chinh-ve-trat-tu-atgt-duong-bo-119241231164556785.htm'
# Individually checked money, exact point, points/suspension and 238 amendment scope.
MAPPING = [
    ('oto-toc-do-5-10',6,3,'a',None), ('oto-toc-do-10-20',6,5,'đ',2),
    ('oto-toc-do-20-35',6,6,'a',4), ('oto-toc-do-tren-35',6,7,'a',6),
    ('mt-toc-do-5-10',7,2,'b',None), ('mt-toc-do-10-20',7,4,'a',None),
    ('mt-toc-do-tren-20',7,8,'a',4), ('oto-con-muc-1',6,6,'c',4),
    ('oto-con-muc-2',6,9,'a',10), ('oto-con-muc-3',6,11,'a',None),
    ('oto-con-khong-chap-hanh',6,11,'b',None), ('mt-con-muc-1',7,6,'a',4),
    ('mt-con-muc-2',7,8,'b',10), ('mt-con-muc-3',7,9,'d',None),
    ('mt-con-khong-chap-hanh',7,9,'đ',None), ('oto-den-do',6,9,'b',4),
    ('mt-den-do',7,7,'c',4), ('oto-dien-thoai',6,5,'h',4),
    ('mt-dien-thoai',7,4,'đ',4), ('mt-mu-bao-hiem',7,2,'h',None),
    ('oto-day-an-toan',6,3,'k',None),
]

def main():
    folder = Path(sys.argv[1])
    raw = (folder/'168.html').read_bytes()
    content = html.fromstring(raw).xpath('//*[contains(@class,"detail-content")]')[0]
    text = re.sub(r'\s+', ' ', ' '.join(content.itertext())).strip()
    articles = {}
    for a in (6,7):
        body = text.split(f'Điều {a}.',1)[1].split(f'Điều {a+1}.',1)[0]
        clauses = {}
        matches = list(re.finditer(r'(?<!\d)(\d+)\. (?=[A-ZĐ])',body))
        for i,m in enumerate(matches):
            chunk = body[m.end():matches[i+1].start() if i+1<len(matches) else len(body)].strip()
            pm = list(re.finditer(r'(?<!\w)([a-zđ])\s*\)\s+',chunk))
            clauses[int(m[1])] = {'intro':chunk[:pm[0].start()].strip() if pm else chunk,
                'points':{p[1]:chunk[p.end():pm[j+1].start() if j+1<len(pm) else len(chunk)].strip() for j,p in enumerate(pm)}}
        articles[a] = clauses
    drafts = {x['ma']:x for x in json.loads((ROOT/'data/tra-cuu/muc-phat.json').read_text(encoding='utf-8'))['dong']}
    provisions = {}
    rows = []
    def keep(a,k,p):
        path=f'dieu-{a}.khoan-{k}'+(f'.diem-{p}' if p else '')
        c=articles[a][k]; value=c['points'][p] if p else c['intro']
        provisions[path] = value
        return path,value
    for code,a,k,p,points in MAPPING:
        d=drafts[code].copy(); path,behavior=keep(a,k,p); keep(a,k,None)
        intro=articles[a][k]['intro']
        money=re.search(r'Phạt tiền từ ([\d.]+) đồng đến ([\d. ]+) đồng',intro)
        assert money, intro
        d.update(hanh_vi=behavior.rstrip(';.'),phat_tu=int(money[1].replace('.','')),
                 phat_den=int(re.sub(r'[. ]','',money[2])),tru_diem=points,
                 can_cu='vn:vbqppl:nd:168/2024/NĐ-CP#'+path,trang_thai='cho_duyet')
        suspension = [22,24] if 'con-muc-3' in code or 'con-khong' in code else None
        d['hinh_thuc_bo_sung'] = ['Tước quyền sử dụng giấy phép lái xe từ 22 tháng đến 24 tháng'] if suspension else []
        d['suspension_months'] = suspension
        d['conditions'] = ['Khung thông thường của hành vi tại điểm được dẫn; phải đối chiếu tình tiết và trường hợp loại trừ.']
        d['required_facts'] = ['Loại phương tiện và hành vi cụ thể', 'Có gây tai nạn giao thông hoặc thuộc khung khác không', 'Tình trạng giấy phép lái xe, trường hợp không trừ điểm theo Điều 50']
        if 'toc-do' in code:d['required_facts'] += ['Tốc độ cho phép, tốc độ xác định và số km/h vượt quá']
        if 'con-muc' in code:d['required_facts'] += ['Kết quả đo nồng độ cồn và đơn vị đo']
        rows.append(d)
    # Preserve supporting sanctions and accident provisions, rather than inventing them.
    for a,k in [(6,15),(6,16),(7,12),(7,13),(6,10),(7,10)]:
        keep(a,k,None)
        for p in articles[a][k]['points']:keep(a,k,p)
    result={'source_url':URL,'source_sha256':hashlib.sha256(raw).hexdigest(),
            'signed_pdf_url':'https://datafiles.chinhphu.vn/cpp/files/vbpq/2025/01/168-nd-cp.signed.pdf',
            'signed_pdf_sha256':hashlib.sha256((folder/'168.pdf').read_bytes()).hexdigest(),
            'amendment_url':'https://congbao.chinhphu.vn/van-ban/nghi-dinh-so-238-2026-nd-cp-469913.htm',
            'amendment_sha256':hashlib.sha256((folder/'238.pdf').read_bytes()).hexdigest(),
            'amendment_check':'Đối chiếu toàn bộ NĐ 238/2026, gồm Điều 2, 17, 19, 20, 21: các điểm hành vi được chọn và mức phạt tại đây không bị thay đổi. Điều 50 về thực hiện trừ điểm phải đối chiếu theo tình trạng GPLX.',
            'provisions':provisions,'dong':rows}
    (ROOT/'data/tra-cuu/muc-phat-reviewed-source.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
    print('Extracted',len(rows),'rows; requires a separate review manifest.')

if __name__=='__main__':main()
