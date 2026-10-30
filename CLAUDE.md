# ΕργοΛόγιο — οδηγίες για αλλαγές

Back-office web app της ΔΥΡΑΣ ΤΕΧΝΙΚΗ ΟΕ. Ζωντανή σελίδα: https://nzaggogiannis-crypto.github.io/ergologio/ (GitHub Pages από `main`, root).
Ο χρήστης (Νίκος) γράφει στα ελληνικά· απάντα στα ελληνικά, σύντομα, χωρίς τεχνική ορολογία.

## Ροή αλλαγής
1. Άλλαξε **μόνο** το `src/app.html` (ή `src/shim.js` / `src/gate.html` για σύνδεση/Firebase). Ποτέ απευθείας το `index.html`.
2. `npm install` (μία φορά) και `python3 tools/build.py` → ξαναφτιάχνει το `index.html` (Tailwind μεταγλωττισμένο μέσα).
3. Έλεγχος σύνταξης: πάρε το μεγάλο `<script>` του `index.html` και τρέξε `node --check`.
4. Commit + push στο `main`. Η σελίδα ενημερώνεται σε 1–2 λεπτά· ο χρήστης κάνει Ctrl+F5.
5. **Πάντα και στο artifact του Claude** (ο χρήστης θέλει τις δύο εκδόσεις να είναι πάντα ίδιες): δημοσίευσε το ίδιο `src/app.html` (όχι το `index.html`) στο artifact «ΕργοΛόγιο» https://claude.ai/code/artifact/f9d84153-31a3-4964-9a82-5a1f9954a8c0 — Artifact tool, `url` αυτό, χωρίς αλλαγή στα `capabilities`. Μια αλλαγή θεωρείται ολοκληρωμένη μόνο όταν έχει γίνει και στα δύο.

## Συγχρονισμός GitHub ↔ artifact
- Πηγή αλήθειας για τον κώδικα είναι το `src/app.html` στο `main`. Αλλαγές δεν γίνονται απευθείας στο artifact· αν βρεθεί αλλαγή μόνο στο artifact, πρώτα περνάει στο `src/app.html`, μετά push, μετά δημοσίευση.
- Τα **δεδομένα** δεν μοιράζονται: η σελίδα του GitHub γράφει στο Firebase, το artifact στη βάση του Claude.
- Στο artifact δεν δουλεύουν όσα εξαρτώνται από το build (κλειδί Dropbox, σύνδεση/αποσύνδεση Firebase)· είναι αναμενόμενο.

## Αρχιτεκτονική
- `src/app.html`: όλη η εφαρμογή (vanilla JS). Μιλάει με τη βάση μέσω `window.claude.use('db'|'user')`.
- `src/shim.js`: υλοποιεί αυτό το API πάνω σε Firebase Auth + Firestore (offline cache). Λίστες μέσα σε λίστες κωδικοποιούνται ως `{__nested: JSON}`· `null` σε merge = διαγραφή πεδίου.
- `src/config.json`: Firebase config, email ιδιοκτήτη (`nzaggogiannis@gmail.com`), βάση `(default)`.
- `firestore.rules`: αντίγραφο των κανόνων που έχουν μπει στο Firebase console (project `ergologio-dyras`). Αν αλλάξουν, ο χρήστης τους επικολλά στο console → Firestore → Rules.
- Ρόλοι: **Super Admin** (το email παραπάνω, μόνο αυτός αλλάζει δικαιώματα από τη σελίδα «Χρήστες & δικαιώματα») · `access/<uid>` = `{role: owner|engineer|employee, mods:{me,myinv,dash,invoices,calendar,suppliers,customers,labor,cars,files,notif}, worker, name, email}`.
  Owner = όλα (realOwner=false: χωρίς επαναφορά/demo/διαγραφή όλων). Engineer/employee = `role='employee'` στον κώδικα, βλέπουν μόνο τις ενότητες του `mods` και φορτώνουν μόνο τα αντίστοιχα paths (`MOD_PATHS`). Οι ίδιοι έλεγχοι υπάρχουν στο `firestore.rules`.
  Νέος χρήστης → αίτημα `pending/<uid>` → έγκριση από Super Admin. `meta/links` κρατά τη σύνδεση uid↔καρτέλα εργαζομένου. `shared/transport` = σύνοψη θεωρητικού κόστους μεταφοράς για όσους βλέπουν μόνο αυτοκίνητα.
- Discord: ρύθμιση στο `meta/discord` {url (κύριο), urls:{κατηγορία: webhook}, on, events, sent} — κατηγορίες `DC_EVENTS` (inv, proj, att, remind, users), δρομολόγηση με `dcRoute()`; + αντίγραφο `shared/notify` (για εγκεκριμένους χρήστες). Αποστολή με `discord(ev, title, lines, fields)` από τον browser που κάνει την ενέργεια· υπενθυμίσεις/νέα αιτήματα από ιδιοκτήτη/Super Admin με αποφυγή διπλών μέσω `sent`.
- Δεδομένα: `meta/*`, `inv/<έργο>_<ΕΕΕΕ-ΜΜ>`, `sal/…`, `thr/…`, `att/<ΕΕΕΕ-ΜΜ>-a|b`, `car/<id>_<ΕΕΕΕ>`, `shared/catalog`, `staff/<uid>`, `pending/<uid>/{items,days}`, `meta/files` (λίστα αρχείων/φακέλων) + `fblob/<id>_<n>` (περιεχόμενο PDF σε base64 κομμάτια 700 KB).
- Dropbox (σελίδα Αρχεία, καρτέλα «Dropbox»): OAuth PKCE απευθείας από τον browser, μόνο ανάγνωση (list_folder, search_v2, get_temporary_link). Κλειδί εφαρμογής στο `src/config.json` → `dropboxKey`· redirect URI = η διεύθυνση της σελίδας. Το token μένει στο localStorage της συσκευής (`ergologio-dbx`).
- Η ανάγνωση PDF με AI είναι προς το παρόν απενεργοποιημένη (χρειάζεται δικό της API key / backend).
