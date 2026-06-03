import json, sys
sys.stdout.reconfigure(encoding='utf-8')

def esc(s):
    s = (s or '').replace("'", '').replace('"', '').replace('\n', ' ').replace('\r', '')
    return s[:90].strip()

def map_cat(cats_str):
    c = (cats_str or '').lower()
    if 'food' in c or 'drink' in c: return 'dining'
    if 'talk' in c: return 'talk'
    if 'workshop' in c: return 'workshop'
    if 'launch' in c: return 'launch'
    if 'tour' in c: return 'tour'
    if 'wellness' in c: return 'wellness'
    return 'exhibition'

VALID = {'Christianshavn','Frederiksstaden','Holmen','Islands Brygge','Kongens Nytorv','Kultur','Nordhavn','Rosengård'}
DATE_MAP = {'10 Jun':'June 10','11 Jun':'June 11','12 Jun':'June 12'}
DATE_MAP2 = {'10 June':'June 10','11 June':'June 11','12 June':'June 12'}

# Load data
with open(r'C:\Users\DOJO_001\Documents\New project\output\3daysofdesign\3dod_events_2026_partial.json', encoding='utf-8') as f:
    events = json.load(f)
with open(r'C:\Users\DOJO_001\Documents\New project\output\3daysofdesign\3dod_long_table_dinners_2026.json', encoding='utf-8') as f:
    dinners = json.load(f)
with open(r'C:\Users\DOJO_001\Documents\New project\output\3daysofdesign\3dod_symposium_2026.json', encoding='utf-8') as f:
    symposium = json.load(f)
with open(r'C:\Users\DOJO_001\Documents\New project\output\3daysofdesign\3dod_design_walks_2026.json', encoding='utf-8') as f:
    walks = json.load(f)

lines = ['const FESTIVAL_EVENTS = [']

# General events
lines.append('  // ── GENERAL EVENTS (scraped 700/796) ──────────────────────────────')
for ev in events:
    dist = (ev.get('district') or '').strip()
    if dist not in VALID: dist = 'Kongens Nytorv'
    cat = map_cat(ev.get('categories',''))
    date = DATE_MAP.get(ev.get('day',''), ev.get('day',''))
    title = esc(ev.get('event_title',''))
    venue = esc(ev.get('primary_exhibitor',''))
    addr = esc(ev.get('location',''))
    desc = esc(ev.get('description',''))
    t = ev.get('start_time','') or ''
    e2 = ev.get('end_time','') or ''
    time = f'{t}-{e2}' if t and e2 else (t or e2 or '')
    lines.append(f"  {{title:'{title}',venue:'{venue}',address:'{addr}',date:'{date}',time:'{time}',district:'{dist}',category:'{cat}',desc:'{desc}'}},")

# Long Table Dinners
lines.append('  // ── LONG TABLE DINNERS (유료·예약필수) ──────────────────────────────')
for d in dinners:
    for dt in [x.strip() for x in d['available_dates'].split(';')]:
        date = DATE_MAP2.get(dt, dt)
        dist = (d.get('district') or '').strip()
        if dist not in VALID: dist = 'Kongens Nytorv'
        title = esc(d['title'])
        venue = esc(d['venue'])
        addr = esc(d['address'])
        desc = esc(d['description'])
        price = d.get('price_per_person','')
        time = f"{d['display_start_time']}-{d['display_end_time']}"
        lines.append(f"  {{title:'Long Table Dinner: {title}',venue:'{venue}',address:'{addr}',date:'{date}',time:'{time}',district:'{dist}',category:'dining',desc:'[{price} 예약필수] {desc}'}},")

# Symposium
lines.append('  // ── ENTERING THE NOW SYMPOSIUM (유료·예약필수 @ KLUB) ───────────────')
for s in symposium:
    date = DATE_MAP2.get(s['date'], s['date'])
    cat = 'workshop' if s['item_type'] == 'Workshop' else 'talk'
    prefix = '[Workshop] ' if s['item_type'] == 'Workshop' else '[Symposium] '
    title = esc(s['title'])
    desc = esc(s['description'])
    time = f"{s['start_time']}-{s['end_time']}"
    lines.append(f"  {{title:'{prefix}{title}',venue:'KLUB - Entering the Now Symposium',address:'Linnésgade 25, 1361 Copenhagen',date:'{date}',time:'{time}',district:'Kongens Nytorv',category:'{cat}',desc:'[250 DKK 예약필수] {desc}'}},")

# Design Walks
lines.append('  // ── DESIGN WALKS (유료 가이드 투어) ──────────────────────────────────')
for w in walks:
    for dt in [x.strip() for x in w['available_dates'].split(';')]:
        date = DATE_MAP2.get(dt, dt)
        dist = (w.get('district') or '').strip()
        if dist not in VALID: dist = 'Kongens Nytorv'
        title = esc(w['title'])
        venue = esc(w.get('venue',''))
        addr = esc(w.get('address','') or w.get('venue',''))
        desc = esc(w['description'])
        for t in [x.strip() for x in w['available_times'].split(';')]:
            if ':' in t:
                h = str(int(t.split(':')[0]) + 2)
                end_t = h + ':' + t.split(':')[1]
            else:
                end_t = t
            lines.append(f"  {{title:'Design Walk: {title}',venue:'{venue}',address:'{addr}',date:'{date}',time:'{t}-{end_t}',district:'{dist}',category:'tour',desc:'[250 DKK 예약필수] {desc}'}},")

lines.append('];')

output = '\n'.join(lines)
with open(r'C:\Users\DOJO_001\Documents\GitHub\cph-trip\events-data.js', 'w', encoding='utf-8') as f:
    f.write(output)

print(f'events-data.js generated')
print(f'Lines: {len(lines):,}')
print(f'Size: {len(output.encode())//1024} KB')
print(f'Events: general={len(events)}, dinners={len(dinners)*2}, symposium={len(symposium)}, walks={len([w for w in walks for _ in w["available_dates"].split(";")])  * 2}')
