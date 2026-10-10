"""Φτιάχνει το index.html από τα αρχεία του src/.
Χρήση (από τον φάκελο του repo):  npm install && python3 tools/build.py
- src/app.html   : η εφαρμογή (ίδιος κώδικας με την έκδοση του Claude artifact)
- src/shim.js    : σύνδεση Firebase (Auth + Firestore) με το ίδιο API window.claude.use('db'|'user')
- src/gate.html  : οθόνη σύνδεσης
- src/config.json: στοιχεία Firebase, email ιδιοκτήτη, όνομα βάσης
"""
import json, os, subprocess
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda *a: os.path.join(ROOT, *a)
SRC, GATE, OUT = P('src', 'app.html'), P('src', 'gate.html'), P('index.html')
cfg = json.load(open(P('src', 'config.json'), encoding='utf-8'))
s = open(SRC, encoding='utf-8').read()
def R(a, b, n=1):
    global s
    c = s.count(a); assert c == n, (c, a[:90]); s = s.replace(a, b)

subprocess.run(['npx', 'tailwindcss', '-i', P('tools', 'tw-in.css'), '-o', P('tools', '.site.css'), '--minify', '--content', SRC + ',' + GATE],
               cwd=ROOT, check=True, capture_output=True)
css = open(P('tools', '.site.css')).read(); os.remove(P('tools', '.site.css'))
R('<script src="https://cdn.tailwindcss.com"></script>\n', '')
R("""<script>
  if (window.tailwind) tailwind.config = { theme: { extend: { fontFamily: { sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'] } } } };
</script>
""", f'<style>{css}</style>\n')
R('\ninit();\n</script>', '\nwindow.__fbReady.then(init);\n</script>')
R("'Η ανάγνωση με AI δουλεύει μόνο όταν η σελίδα είναι ανοιχτή μέσα στο Claude'", "'Η ανάγνωση PDF με AI θα ενεργοποιηθεί σε επόμενη ενημέρωση· προς το παρόν πέρασε τα τιμολόγια από τη φόρμα ή από Excel'")
R("αποθηκεύεται αυτόματα στον λογαριασμό σου στο Claude", "αποθηκεύεται αυτόματα στη βάση σου (Google Firebase)")
R("if (isObj(d.extra)) BACKUP_EXTRA.forEach(k => {", "if (isObj(d.extra)) BACKUP_EXTRA.filter(k => !(d.version < 6 && ['meta/links', 'meta/access', 'meta/notif'].includes(k))).forEach(k => {")
R("const data = { app: 'ergologio', version: 5,", "const data = { app: 'ergologio', version: 6,")
R("    : syncState === 'saving' ? ['bg-amber-400 animate-pulse', 'Αποθήκευση…']",
  "    : !navigator.onLine ? ['bg-slate-400', 'Εκτός σύνδεσης · οι αλλαγές θα σταλούν μόλις επανέλθει']\n    : syncState === 'saving' ? ['bg-amber-400 animate-pulse', 'Αποθήκευση…']")
R('      <div id="syncBadge" class="flex items-center gap-2 text-[11px] text-slate-300"></div>',
  '      <div id="syncBadge" class="flex items-center gap-2 text-[11px] text-slate-300"></div>\n      <div id="whoAmI" hidden class="flex items-center gap-2 text-[11px] text-slate-400 mt-1.5 min-w-0"></div>')
R("""    <div id="accessPanel" class="lg:col-span-2 empty:hidden"></div>""", """    <div id="accessPanel" class="lg:col-span-2 empty:hidden"></div>
    <section class="card p-5 md:p-6 fade-in"><h3 class="font-bold">Λογαριασμός</h3><p class="text-sm text-slate-500 mt-1 mb-4">Αποσυνδέσου από αυτή τη συσκευή.</p><button class="btn btn-ghost" onclick="fbSignOut()">Αποσύνδεση</button></section>""")
R("""      <div class="p-2 sm:p-4"><div class="grid grid-cols-7 gap-1 sm:gap-1.5">${cells}</div></div>
    </section>`;""", """      <div class="p-2 sm:p-4"><div class="grid grid-cols-7 gap-1 sm:gap-1.5">${cells}</div></div>
    </section>
    <div class="text-center mt-6"><button class="text-xs text-slate-400 underline" onclick="fbSignOut()">Αποσύνδεση</button></div>`;""")
R('<p class="text-xs text-slate-400 mt-4">Όνομα στο αίτημα: <b class="text-slate-600">${esc(emp.joined.name || \'\')}</b></p></div>`;',
  '<p class="text-xs text-slate-400 mt-4">Όνομα στο αίτημα: <b class="text-slate-600">${esc(emp.joined.name || \'\')}</b> · <button class="underline" onclick="fbSignOut()">Αποσύνδεση</button></p></div>`;')

gate = open(GATE, encoding='utf-8').read()
shim = open(P('src', 'shim.js'), encoding='utf-8').read()
head = f"""<!doctype html>
<html lang="el"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0f172a">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="ΕργοΛόγιο">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%23f59e0b'/%3E%3Ctext x='32' y='45' font-family='Arial' font-weight='800' font-size='38' text-anchor='middle' fill='%230f172a'%3EE%3C/text%3E%3C/svg%3E">
<script>window.FB_CONFIG = {json.dumps(cfg['firebase'])}; window.OWNER_EMAIL = {json.dumps(cfg['owner'])}; window.FB_DB = {json.dumps(cfg.get('db', '(default)'))}; window.DBX_KEY = {json.dumps(cfg.get('dropboxKey', ''))};
window.__fbReady = new Promise(r => window.__fbResolve = r);</script>
"""
open(OUT, 'w', encoding='utf-8').write(head + s + '\n' + gate + f'\n<script type="module">\n{shim}\n</script>\n</body></html>\n')
print('built', OUT)
