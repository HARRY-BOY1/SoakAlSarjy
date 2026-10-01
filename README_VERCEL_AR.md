# نشر سوق الشورجة على Vercel

## التحديث الآمن الجديد

لوحة المدير وتغيير بيانات الحساب الحساسة تحتاج تشغيل `server.js` على Node/Pella أو VPS؛ GitHub Pages وVercel كاستضافة ملفات ثابتة يعرضان الواجهة فقط. لا تضع كلمة مرور المدير أو hash داخل GitHub. اضبط الأسرار في بيئة الاستضافة:

```bash
export ADMIN_PHONE=07748820203
export ADMIN_PASSWORD_HASH='scrypt$...'
npm start
```

ولّد hash محلياً من دون حفظ كلمة المرور في المشروع:

```bash
printf '%s' 'كلمة المرور' | node -e "const crypto=require('crypto');const p=require('fs').readFileSync(0,'utf8').trim();const s=crypto.randomBytes(16).toString('hex');console.log('scrypt$'+s+'$'+crypto.scryptSync(p,s,64).toString('hex'))"
```

التحديث يضيف جلسات خادمية، إدارة الإعلانات والمحتوى، ملفاً شخصياً وإعدادات أمان، ثيمات متعددة، تخطيط شبكة/قائمة، معرض صور وروابط فيديو ورابط تواصل للإعلان، وقناة Telegram الرسمية.

## الطريقة الصحيحة

1. فك ضغط الملف أولاً.
2. ارفع **محتويات المجلد** إلى Vercel أو اربط مستودع GitHub.
3. إذا ظهر خيار Framework اختر `Other` أو اتركه بدون Framework.
4. اترك Build Command فارغاً.
5. اترك Output Directory فارغاً.
6. اضغط Deploy.

لا ترفع ملف `index.html` وحده؛ يجب رفع `index.html` مع `style.css` و`script.js` و`sync.js` ومجلد `assets` وباقي الملفات.

## قاعدة البيانات

تم ربط النسخة الحالية بمشروع Supabase من خلال جدول `marketplace_state`. عند فتح الموقع، يتم تحميل الحسابات والإعلانات والمفضلة والرسائل والتقييمات والإشعارات من Supabase، وأي تغيير جديد يتم حفظه تلقائياً.

لا تحتاج إلى إضافة مفاتيح داخل Vercel لهذه النسخة؛ رابط المشروع والمفتاح العام موجودان في `index.html`. المفتاح المستخدم browser-safe (publishable/anon) ولا يجب استبداله بـ `service_role`.

ملاحظة: الحفظ الحالي يجمع حالة التطبيق في سجل واحد لتوافقه مع الواجهة الحالية. قبل التوسع الكبير يفضّل تحويل البيانات إلى جداول منفصلة وربط تسجيل الدخول بـ Supabase Auth.

## إذا كان عندك VPS أو سيرفر Node

استخدم بدلاً من ذلك:

```bash
npm install --omit=dev
npm start
```

هذه الطريقة تشغّل `server.js` وتوفر API والمزامنة.
