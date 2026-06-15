import { dirname } from 'path'
import { fileURLToPath } from 'url'
import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import { ffmpeg } from './converter.js'
import fluent_ffmpeg from 'fluent-ffmpeg'
import { spawn } from 'child_process'
import uploadFile from './uploadFile.js'
import uploadImage from './uploadImage.js'
import { fileTypeFromBuffer } from 'file-type'
import webp from 'node-webpmux'
import fetch from 'node-fetch'
import { format } from 'util' // استيراد دالة الفرمتة الاحتياطية

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const tmp = path.join(__dirname, '../tmp')

// مصفوفة تفعيل ومراقبة حزم دعم المعالجة الخارجية على نظام التشغيل
const support = {
  ffmpeg: true,
  ffprobe: true,
  ffmpegWebp: true,
  convert: true,
  magick: false,
  gm: false,
  find: false
}

/**
 * تحويل الصورة إلى ملصق (الطريقة الثانية): باستخدام أدوات المعالجة المباشرة FFmpeg و GraphicsMagick
 * @param {Buffer} img بافر الصورة
 * @param {String} url رابط الصورة
 */
function sticker2(img, url) {
  return new Promise(async (resolve, reject) => {
    try {
      if (url) {
        let res = await fetch(url)
        if (res.status !== 200) throw await res.text()
        img = await res.buffer()
      }
      let inp = path.join(tmp, +new Date + '.jpeg')
      await fs.promises.writeFile(inp, img)
      
      // تهيئة معايير معالجة أبعاد الملصق القياسية (512x512) مع خلفية شفافة لمنع تشوه المظهر
      let ff = spawn('ffmpeg', [
        '-y',
        '-i', inp,
        '-vf', 'scale=512:512:flags=lanczos:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000,setsar=1',
        '-f', 'png',
        '-'
      ])
      ff.on('error', reject)
      ff.on('close', async () => {
        await fs.promises.unlink(inp)
      })
      let bufs = []
      
      // إصلاح طريقة قراءة مصفوفة الدعم بنظام ESM
      const [_spawnprocess, ..._spawnargs] = [...(support.gm ? ['gm'] : support.magick ? ['magick'] : []), 'convert', 'png:-', 'webp:-']
      
      let im = spawn(_spawnprocess, _spawnargs)
      im.on('error', reject) // تم الإصلاح: تمرير الخطأ للمحاولة التالية بدلاً من محاولة الرد بمتغيرات غير معرفة
      im.stdout.on('data', chunk => bufs.push(chunk))
      ff.stdout.pipe(im.stdin)
      im.on('exit', () => {
        resolve(Buffer.concat(bufs))
      })
    } catch (e) {
      reject(e)
    }
  })
}

/**
 * دالة معالجة محاكاة الكانفاس الافتراضي وتوليد ملف ميديا عبر سيرفر خارجي
 */
async function canvas(code, type = 'png', quality = 0.92) {
  let res = await fetch('https://nurutomo.herokuapp.com/api/canvas?' + queryURL({
    type,
    quality
  }), {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain',
      'Content-Length': code.length
    },
    body: code
  })
  let image = await res.buffer()
  return image
}

function queryURL(queries) {
  return new URLSearchParams(Object.entries(queries))
}

/**
 * تحويل الصورة إلى ملصق (الطريقة الأولى): باستخدام نظام رسم الكانفاس البرمجي
 * @param {Buffer} img بافر الصورة
 * @param {String} url رابط الصورة
 */
async function sticker1(img, url) {
  url = url ? url : await uploadImage(img)
  let { mime } = url ? { mime: 'image/jpeg' } : await fileTypeFromBuffer(img)
  let sc = `let im = await loadImg('data:${mime};base64,'+(await window.loadToDataURI('${url}')))
c.width = c.height = 512
let max = Math.max(im.width, im.height)
let w = 512 * im.width / max
let h = 512 * im.height / max
ctx.drawImage(im, 256 - w / 2, 256 - h / 2, w, h)
`
  return await canvas(sc, 'webp')
}

/**
 * تحويل الميديا إلى ملصق (الطريقة الثالثة): التوليد عبر سرفرات الـ API الخارجية مع دمج الحقوق مباشرة
 * @param {Buffer} img بافر الصورة أو الفيديو
 * @param {String} url رابط الميديا
 * @param {String} packname اسم حزمة الملصقات
 * @param {String} author اسم الحقوق / المصمم
 */
async function sticker3(img, url, packname, author) {
  url = url ? url : await uploadFile(img)
  let res = await fetch('https://api.xteam.xyz/sticker/wm?' + new URLSearchParams(Object.entries({
    url,
    packname,
    author
  })))
  return await res.buffer()
}

/**
 * تحويل الصورة إلى ملصق (الطريقة الرابعة): معالجة سريعة عبر وحدة تحويل FFmpeg الداخلية
 * @param {Buffer} img بافر الميديا
 * @param {String} url رابط الميديا
 */
async function sticker4(img, url) {
  if (url) {
    let res = await fetch(url)
    if (res.status !== 200) throw await res.text()
    img = await res.buffer()
  }
  return await ffmpeg(img, [
    '-vf', 'scale=512:512:flags=lanczos:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000,setsar=1'
  ], 'jpeg', 'webp')
}

/**
 * تحويل الميديا إلى ملصق (الطريقة الخامسة): استخدام مكتبة التنسيق الحديثة واختيار التصنيفات (Emojis)
 */
async function sticker5(img, url, packname, author, categories = [''], extra = {}) {
  const { Sticker } = await import('wa-sticker-formatter')
  const stickerMetadata = {
    type: 'default',
    pack: packname,
    author,
    categories,
    ...extra
  }
  return (new Sticker(img ? img : url, stickerMetadata)).toBuffer()
}

/**
 * تحويل الميديا إلى ملصق (الطريقة السادسة): دعم تحويل الفيديوهات القصيرة والصور المتحركة (GIF) عبر Fluent-FFmpeg
 * @param {string} img 
 * @param {string} url 
 */
function sticker6(img, url) {
  return new Promise(async (resolve, reject) => {
    if (url) {
      let res = await fetch(url)
      if (res.status !== 200) throw await res.text()
      img = await res.buffer()
    }
    const type = await fileTypeFromBuffer(img) || {
      mime: 'application/octet-stream',
      ext: 'bin'
    }
    if (type.ext == 'bin') reject(img)
    const tmpFile = path.join(tmp, `${+ new Date()}.${type.ext}`)
    const out = path.join(tmpFile + '.webp')
    await fs.promises.writeFile(tmpFile, img)
    
    // التحقق التلقائي إذا كانت الميديا فيديو لتهيئة إعدادات معالجة الفريمات ومعدل التحديث (FPS) للرسوم المتحركة
    let Fffmpeg = /video/i.test(type.mime) ? fluent_ffmpeg(tmpFile).inputFormat(type.ext) : fluent_ffmpeg(tmpFile).input(tmpFile)
    Fffmpeg
      .on('error', function (err) {
        console.error('حدث خطأ أثناء معالجة ملصق الفيديو الفلوينت:', err)
        fs.promises.unlink(tmpFile).catch(() => {})
        reject(img)
      })
      .on('end', async function () {
        fs.promises.unlink(tmpFile).catch(() => {})
        resolve(await fs.promises.readFile(out))
      })
      .addOutputOptions([
        `-vcodec`, `libwebp`, `-vf`,
        `scale='min(320,iw)':min'(320,ih)':force_original_aspect_ratio=decrease,fps=15, pad=320:320:-1:-1:color=white@0.0, split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=ffffff [p]; [b][p] paletteuse`
      ])
      .toFormat('webp')
      .save(out)
  })
}

/**
 * حقن بيانات EXIF والـ Metadata المخصصة للملصقات داخل حزمة الـ WebP (تسمية الحقوق والحزمة لتبدو رسمية)
 * @param {Buffer} webpSticker بافر ملصق الـ WebP الخام
 * @param {String} packname اسم الحزمة
 * @param {String} author اسم المصمم
 * @param {String} categories الرموز التعبيرية المرتبطة
 */
async function addExif(webpSticker, packname, author, categories = [''], extra = {}) {
  const img = new webp.Image();
  const stickerPackId = crypto.randomBytes(32).toString('hex');
  const json = { 
    'sticker-pack-id': stickerPackId, 
    'sticker-pack-name': packname, 
    'sticker-pack-publisher': author, 
    "android-app-store-link": "https://play.google.com/store/apps/details?id=com.marsvard.stickermakerforwhatsapp", 
    "ios-app-store-link": "https://itunes.apple.com/app/sticker-maker-studio/id1443326857", 
    'emojis': categories, 
    ...extra 
  };
  let exifAttr = Buffer.from([0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00]);
  let jsonBuffer = Buffer.from(JSON.stringify(json), 'utf8');
  let exif = Buffer.concat([exifAttr, jsonBuffer]);
  exif.writeUIntLE(jsonBuffer.length, 14, 4);
  await img.load(webpSticker)
  img.exif = exif
  return await img.save(null)
}

/**
 * الدالة الهجينة الرئيسية (الشاملة): تحاول استخدام كافة الطرق المتاحة بالترتيب وتضمن نجاح توليد الملصق وحقن الحقوق
*/
async function sticker(img, url, ...args) {
  let lastError, stiker
  for (let func of [
    sticker3, support.ffmpeg && sticker6, sticker5,
    support.ffmpeg && support.ffmpegWebp && sticker4,
    support.ffmpeg && (support.convert || support.magick || support.gm) && sticker2,
    sticker1
  ].filter(f => f)) {
    try {
      stiker = await func(img, url, ...args)
      if (stiker.includes('html')) continue
      if (stiker.includes('WEBP')) {
        try {
          return await addExif(stiker, ...args)
        } catch (e) {
          console.error('فشل تدميج بيانات الإكسيف (الحقوق)، تم إرجاع الملصق بدونها:', e)
          return stiker
        }
      }
      throw stiker.toString()
    } catch (err) {
      lastError = err
      continue
    }
  }
  console.error('جميع محاولات إنشاء الملصق باءت بالفشل، آخر خطأ مرصود هو:', lastError)
  return lastError
}

export {
  sticker,
  sticker1,
  sticker2,
  sticker3,
  sticker4,
  sticker6,
  addExif,
  support
}
