console.log('✅ جاري البدء...')

import { join, dirname } from 'path'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { setupMaster, fork } from 'cluster'
import { watchFile, unwatchFile } from 'fs'
import cfonts from 'cfonts'
import { createInterface } from 'readline'
import yargs from 'yargs'
import express from 'express'
import chalk from 'chalk'
import path from 'path'
import os from 'os'
import { promises as fsPromises } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const require = createRequire(__dirname)
const { say } = cfonts
const rl = createInterface(process.stdin, process.stdout)

const app = express()
const port = process.env.PORT || 8080

// ==========================================
// [ حقن الحقوق الجديدة واجهة العرض النصية ]
// ==========================================
say('⛩️ 𝐃𝐈𝐕𝐎𝐎 𝐈𝐍 友', {
  font: 'pallet',
  align: 'center',
  gradient: ['red', 'magenta']
})

say('البوت بواسطة المطور | @𝐃𝐄𝐕 𝐀𝐁𝐎𝐎𝐃𝐈', {
  font: 'console',
  align: 'center',
  gradient: ['cyan', 'magenta']
})

// تشغيل خادم الويب (Express) للحفاظ على استضافة البوت حية
app.listen(port, () => {
  console.log(chalk.green(`🌐 المنفذ (Port) ${port} مفتوح ويعمل بنجاح`))
})

let isRunning = false
let isRestarting = false

async function start(file) {
  if (isRunning) return
  isRunning = true

  let args = [join(__dirname, file), ...process.argv.slice(2)]

  say([process.argv[0], ...args].join(' '), {
    font: 'console',
    align: 'center',
    gradient: ['red', 'magenta']
  })

  setupMaster({
    exec: args[0],
    args: args.slice(1),
  })

  let p = fork()

  // 📩 استقبال الرسائل من العملية الابنة (الملف الأساسي للبوت)
  p.on('message', data => {
    console.log('[رسالة واردة]', data)

    switch (data) {
      case 'reset':
        isRestarting = true
        p.process.kill()
        break

      case 'uptime':
        p.send(process.uptime())
        break
    }
  })

  // ❌ التعامل مع توقف أو خروج العملية
  p.on('exit', (code) => {
    isRunning = false

    if (isRestarting) {
      console.log(chalk.yellow('🔄 تم اكتشاف إعادة تشغيل يدوية...'))
      isRestarting = false
      return start(file)
    }

    console.error('❎ خطأ غير متوقع، رمز الخروج:', code)

    // إذا توقف البوت بسبب خطأ، يتم مراقبة الملف لإعادة تشغيله فور التعديل
    if (code !== 0) {
      watchFile(args[0], () => {
        unwatchFile(args[0])
        console.log(chalk.blue('♻️ تم تحديث الملف الأساسي، جاري إعادة التشغيل التلقائي...'))
        start(file)
      })
    }
  })

  // 🖥 معلومات النظام والسرعة
  console.log(chalk.yellow(`🖥️ نظام التشغيل: ${os.type()}, إصدار: ${os.release()} - المعمارية: ${os.arch()}`))
  console.log(chalk.yellow(`💾 إجمالي الرام الكلي: ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB`))
  console.log(chalk.yellow(`💽 الرام الفارغ المتاح: ${(os.freemem() / 1024 / 1024 / 1024).toFixed(2)} GB`))

  // قراءة معلومات المشروع من ملف package.json
  try {
    const packageJsonData = await fsPromises.readFile('./package.json', 'utf-8')
    const packageJsonObj = JSON.parse(packageJsonData)

    console.log(chalk.blue.bold('\n📦 معلومات حزمة البوت (Package)'))
    console.log(chalk.cyan(`الاسم: ${packageJsonObj.name}`))
    console.log(chalk.cyan(`الإصدار: ${packageJsonObj.version}`))
    console.log(chalk.cyan(`المطور: ${packageJsonObj.author?.name || 'غير محدد'}`))
  } catch (err) {
    console.error(chalk.red('❌ تعذر قراءة ملف package.json لقراءة الحقوق الحالية'))
  }

  // طباعة الوقت الحالي بناءً على النطاق الزمني المحدد
  console.log(chalk.blue.bold('\n⏰ الوقت الحالي (المنطقة الزمنية)'))
  console.log(
    chalk.cyan(
      new Date().toLocaleString('ar-EG', { // تم تغيير لغة عرض الوقت إلى العربية
        timeZone: 'Africa/Cairo' // يمكنك استبدالها بـ Asia/Riyadh أو النطاق الخاص بك
      })
    )
  )

  setInterval(() => {}, 1000)

  // 📟 وحدة التحكم التفاعلية المدخلة عبر الطرفية (Terminal)
  let opts = new Object(yargs(process.argv.slice(2)).exitProcess(false).parse())

  if (!opts['test'])
    if (!rl.listenerCount())
      rl.on('line', line => {
        p.emit('message', line.trim())
      })
}

//--- تشغيل البوت الفرعي (Sub Bot) إن وجد مستقبلاً
///

start('main.js')
