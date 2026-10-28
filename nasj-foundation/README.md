# NASJ Embroidery Studio — Foundation Round 06

تضيف الجولة السادسة متحكمًا مستقلًا للتقدم داخل الخط الزمني المنطقي الذي بُني في الجولة الخامسة. يمكن تحريك المؤشر للأمام والخلف، والانتقال إلى حدث محدد، وإعادة الضبط، واستخراج حالة معاينة عند كل موضع. لا تُنشئ هذه الوحدة واجهة رسومية ولا تحاكي حالة الإبرة الميكانيكية.

تحافظ الحزمة على الأساس السابق: نموذج المشروع schema v2، ترحيل v1 → v2، حفظ/فتح المستند، عقود الهندسة ومحرك running-stitch الأولي، صيغة خطة الغرز JSON v1، تسلسل الخيوط v1، وخط الأحداث المنطقي.

## نطاق الجولة

- `src/playback-controller.js`: تحقق صارم من خط زمني v1 ومتحكم cursor مستقل عن الواجهة.
- `test/playback-controller.test.js`: اختبارات البدء، والتقدم والتراجع، والبحث عن موضع، وإعادة الضبط، وحالة الخيط/الموضع، وحدود المؤشر، ومقاومة تعديل البيانات من الخارج.
- `docs/playback-controller-v1.md`: تعريف حالة المؤشر ومعاني التقدم وحدود الوحدة.

لم تتغير صيغة مستند المشروع `schemaVersion: 2`، أو صيغة خطة الغرز `nasj-stitch-plan` v1، أو صيغة تسلسل الخيوط `nasj-stitch-sequence` v1، أو صيغة الخط الزمني v1. لا توجد ترحيلات ملفات مطلوبة لهذه الإضافة.

## التشغيل

يتطلب Node.js 20 أو أحدث ولا يحتاج إلى اعتماديات خارجية.

```sh
npm run check
npm test
```

## مثال

```js
import { createPlaybackController } from "./src/playback-controller.js";
import { simulateStitchSequence } from "./src/stitch-sequence.js";

const timeline = simulateStitchSequence(sequence);
const playback = createPlaybackController(timeline);
playback.next();
const frame = playback.seek(12);
console.log(frame.progress, frame.positionMm, frame.activeThread);
playback.previous();
```

المؤشر يبدأ عند `eventIndex: -1`، أي قبل أول حدث. `progress` نسبة الأحداث المطبقة، بينما `stitchProgress` نسبة حركات الغرز المطبقة. كلتاهما مؤشرات منطقية وليستا وقت تشغيل أو نسبة اكتمال فيزيائية.

## الحدود والمخاطر

- لا توجد أزرار أو واجهة عرض أو تشغيل تلقائي بتوقيت زمني.
- `positionMm` موضع في خط المعاينة، وليس قياسًا لحركة إبرة فعلية.
- لا توجد حالات needle-up/down، أو قص خيط، أو تسارع ماكينة، أو توتر خيط.
- التحقق الصارم من خط الأحداث يزيد كلفة إنشاء المتحكم خطيًا مع عدد الأحداث؛ الحد الأعلى مشتق من حدود الجولة الخامسة.
- لا تدعم الحزمة بعد DST/PES/EXP أو أي ملف جاهز لماكينة تطريز.

راجع `docs/playback-controller-v1.md` و`GITHUB_TERMUX_COMMANDS.md` قبل أي دمج اختياري. لم تُرفع هذه الحزمة إلى GitHub.
