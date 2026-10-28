# أوامر Termux الآمنة — NASJ Foundation Round 06

هذه الخطوات اختيارية. الحزمة لا ترفع أو تدمج أي شيء تلقائيًا. اختبرها خارج المستودع أولًا. لا تستخدم `git reset --hard` أو `git clean`، ولا تضع رمز وصول في ملف أو أمر أو رابط remote.

## 1. فك الحزمة واختبرها منفصلة

```sh
set -eu
ZIP="$HOME/storage/downloads/nasj-foundation-round-06.zip"
STAGE="$HOME/nasj-foundation-round-06-stage"
mkdir -p "$STAGE"
unzip -q "$ZIP" -d "$STAGE"
cd "$STAGE/nasj-foundation-round-06"
npm run check
npm test
```

لا تتابع إذا فشل أي اختبار.

## 2. افحص المستودع قبل التغيير

```sh
cd "$HOME/gold-letter"
git remote -v
git status --short --branch
git log -1 --oneline
if [ -n "$(git status --porcelain)" ]; then
  echo "Working tree is not clean. Back up and review changes first." >&2
  exit 1
fi
```

تأكد يدويًا أن `origin` هو المستودع المقصود وأن الجولات السابقة موجودة فعلًا في الفرع. لا تفترض أن تشابه أسماء الملفات يعني تطابق محتواها.

## 3. أنشئ فرعًا منفصلًا

```sh
git switch -c nasj/playback-controller-round-06
```

إذا كان الاسم موجودًا، اختر اسمًا جديدًا ولا تحذف الفرع القديم.

## 4. احتفظ بنسخة احتياطية من الملفات المتعارضة

```sh
set -eu
REPO="$HOME/gold-letter"
SOURCE="$HOME/nasj-foundation-round-06-stage/nasj-foundation-round-06"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$HOME/nasj-backups/gold-letter-round-06-$STAMP"
mkdir -p "$BACKUP"
cd "$REPO"

for p in package.json README.md CHANGELOG.md GITHUB_TERMUX_COMMANDS.md; do
  if [ -e "$p" ]; then
    mkdir -p "$BACKUP/$(dirname "$p")"
    cp -a "$p" "$BACKUP/$p"
  fi
done
for p in src/playback-controller.js test/playback-controller.test.js docs/playback-controller-v1.md; do
  if [ -e "$p" ]; then
    mkdir -p "$BACKUP/$(dirname "$p")"
    cp -a "$p" "$BACKUP/$p"
  fi
done
```

هذه نسخة احتياطية وليست موافقة على الاستبدال. قارن الملفات المتعارضة يدويًا. لا تستبدل `package.json` أو `README.md` كاملًا إذا كان مستودعك يحتوي إعدادات أو توثيقًا إضافيًا؛ ادمج التغييرات المطلوبة فقط. لا تستبدل ملفات الجولات السابقة لمجرد اختلافها.

بعد التأكد من المسارات ومراجعة التعارضات، انسخ الوحدة الجديدة واختباراتها وتوثيقها:

```sh
cp -a "$SOURCE/src/playback-controller.js" src/playback-controller.js
cp -a "$SOURCE/test/playback-controller.test.js" test/playback-controller.test.js
mkdir -p docs
cp -a "$SOURCE/docs/playback-controller-v1.md" docs/playback-controller-v1.md
```

ادمج تحديثات `package.json` و`README.md` و`CHANGELOG.md` و`GITHUB_TERMUX_COMMANDS.md` يدويًا. لا تغيّر مخطط المستند أو صيغة خط الأحداث في هذه الجولة.

## 5. شغّل الفحوص وراجع الفرق

```sh
npm run check
npm test
git diff --check
git status --short
git diff --stat
git diff
```

الملفات الجديدة غير المتعقبة لا تظهر في `git diff` قبل إضافتها. أضف الملفات المقصودة فقط ثم راجع الفرق المرحلي:

```sh
git add src/playback-controller.js test/playback-controller.test.js docs/playback-controller-v1.md
git diff --cached --check
git diff --cached
npm run check
npm test
```

أضف ملفات التوثيق العامة أو بيانات الحزمة فقط بعد دمجها ومراجعتها. أعد الفحوص بعد أي تعديل. لا تعمل commit عند فشل اختبار أو وجود فرق غير مفهوم أو أسرار.

## 6. Commit وpush اختياريان بعد نجاح كل الفحوص

```sh
git commit -m "Add deterministic NASJ playback cursor"
git push -u origin "$(git branch --show-current)"
```

لا تضع رمز وصول داخل URL أو سجل الأوامر. استخدم آلية مصادقة GitHub الآمنة المهيأة على جهازك. لا تنفذ هذه الخطوات إلا إذا قررت الرفع بنفسك.

## 7. Pull Request بعد نجاح الاختبارات والرفع فقط

تحقق من الفرع الأساسي ثم افتح Pull Request للمراجعة. لا تدمج مباشرة في الفرع الأساسي. لا تصف المؤشر بأنه محاكاة إبرة فعلية أو ملف متوافق مع ماكينة.
