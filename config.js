import { watchFile, unwatchFile } from 'fs'
import chalk from 'chalk' 
import { fileURLToPath } from 'url' 

// ==========================================
// [ قسم الحقوق الجديدة والإعدادات الأساسية ]
// ==========================================

global.owner = [
  ['249112727808', '𝐃𝐄𝐕 𝐀𝐁𝐎𝐎𝐃𝐈', true], // رقم المطور الأساسي
  ['213553240538']
] // أرقام المطورين والمالكين للبوت

global.mods = [''] // المشرفين / المودز
global.prems = ['249112727808', '213553240538'] // المستخدمين المميزين (بريميوم)
global.botNumber = ['96876430222']  //-- رقم البوت الخاص بك

// مزودو خدمات الـ API
global.APIs = { // اختصارات مواقع الـ API
  fg_ss: 'https://fg-ss.ddns.net',
  fgmods: 'https://api.fgmods.xyz'
}
global.APIKeys = { // مفاتيح الـ API الخاصة بالخدمات
  '' //--- التسجيل عبر موقع https://api.fgmods.xyz/
}

// ==========================================
// [ حقوق الملصقات (Sticker WM) ]
// ==========================================
global.packname = '⛩️ 𝐃𝐈𝐕𝐎𝐎 𝐈𝐍 友' // اسم حزمة الملصقات المحدث
global.author = 'https://wa.me/message/72R5BJPAHVO7G1' // معرف المطور الجديد للملصقات

// ==========================================
// [ معلومات البوت والمطور الجديدة ]
// ==========================================
global.botName = '⛩️ 𝐃𝐈𝐕𝐎𝐎 𝐈𝐍 友' // اسم البوت الخاص بك
global.fg_ig = 'https://www.instagram.com/boodixx9?igsh=NjIwdjF1bHJwdWlm' // حساب الإنستغرام الجديد
global.fg_sc = '' // رابط السورس الخاص بك على جيت هاب
global.fg_yt = '' // قناة اليوتيوب الجديدة
global.fg_pyp = 'https://wa.me/message/72R5BJPAHVO7G1' // رابط الدعم المادي بايبال
global.fg_tt = 'https://tiktok.com/@_a__3_y_tiktok' // حساب التيك توك الجديد
global.fg_logo = 'https://i.postimg.cc/50cBg3x3/09267fa6faa74dd6ff135ef2f78e68a8.jpg' // رابط شعار البوت (اللوجو)
global.fg_avatar = 'https://i.postimg.cc/50cBg3x3/09267fa6faa74dd6ff135ef2f78e68a8.jpg' // الصورة الشخصية للبوت

// ==========================================
// [ روابط ومجموعات الواتساب ]
// ==========================================
global.id_canal = '120363407991526193@newsletter' //- معرف قناة الواتساب الأساسية
global.canal_log = 'https://whatsapp.com/channel/0029VbD2uOa6rsQqt4yQQW0Y' // رابط قناة السجلات
global.canal_logid = '120363407991526193@newsletter' // معرف قناة السجلات
global.fg_canal = 'https://whatsapp.com/channel/0029VbD0h4pBPzjZ3hTsPP02' // رابط قناة الدعم
global.fg_group = "https://chat.whatsapp.com/BpxAOJRsYk12K0mKwm97eY" // رابط مجموعة الدعم العام
global.fg_gpnsfw = 'https://chat.whatsapp.com/DXCA0edzMt32sxtlCSxUCD' //-- رابط مجموعة المحتوى الحساس (NSFW)

// ==========================================
// [ التفاعلات والرموز التعبيرية ]
// ==========================================
global.rwait = '⌛' // رمز الانتظار
global.dmoji = '🤭' // رمز التفاعل الافتراضي
global.done = '✅' // رمز الإتمام بنجاح
global.error = '❌' // رمز حدوث خطأ
global.xmoji = '🔥' // رمز التميز/الحماس

global.multiplier = 69 // معامل زيادة الخبرة (XP) لليفل

// ==========================================
// [ نظام التحديث التلقائي للملف ]
// ==========================================
let file = fileURLToPath(import.meta.url)
watchFile(file, () => {
  unwatchFile(file)
  console.log(chalk.redBright("تحديث ملف الإعدادات 'config.js'"))
  import(`${file}?update=${Date.now()}`)
})
