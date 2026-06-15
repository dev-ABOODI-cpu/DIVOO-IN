//-- process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
import './config.js';
import { createRequire } from "module"; // جلب القدرة على استخدام دالة 'require' داخل نظام ESM
import path, { join } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { platform } from 'process'
import * as ws from 'ws';
import chalk from 'chalk'
import { readdirSync, statSync, unlinkSync, existsSync, readFileSync, watch, rmSync } from 'fs';
import yargs from 'yargs';
import { spawn } from 'child_process';
import lodash from 'lodash';
import syntaxerror from 'syntax-error';
import { tmpdir } from 'os';
import { format } from 'util';

//import makeWASocket from '@whiskeysockets/baileys'
import { makeWASocket } from './lib/simple.js'
import { protoType, serialize } from './lib/simple.js'

import { Low, JSONFile } from 'lowdb';
import pino from 'pino';
import { mongoDB, mongoDBV2 } from './lib/mongoDB.js';
import store from './lib/store.js'
import readline from 'readline'

const {
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    jidNormalizedUser
} = await import('@whiskeysockets/baileys')
import moment from 'moment-timezone'
import NodeCache from 'node-cache'
import fs from 'fs'
const { chain } = lodash

protoType()
serialize()

global.__filename = function filename(pathURL = import.meta.url, rmPrefix = platform !== 'win32') { return rmPrefix ? /file:\/\/\//.test(pathURL) ? fileURLToPath(pathURL) : pathURL : pathToFileURL(pathURL).toString() }; 
global.__dirname = function dirname(pathURL) { return path.dirname(global.__filename(pathURL, true)) }; 
global.__require = function require(dir = import.meta.url) { return createRequire(dir) }

global.API = (name, path = '/', query = {}, apikeyqueryname) => (name in global.APIs ? global.APIs[name] : name) + path + (query || apikeyqueryname ? '?' + new URLSearchParams(Object.entries({ ...query, ...(apikeyqueryname ? { [apikeyqueryname]: global.APIKeys[name in global.APIs ? global.APIs[name] : name] } : {}) })) : '')
global.timestamp = {
    start: new Date
}

const __dirname = global.__dirname(import.meta.url)

global.opts = new Object(yargs(process.argv.slice(2)).exitProcess(false).parse())
global.prefix = new RegExp('^[' + (opts['prefix'] || '‎z/i!#$%+£¢€¥^°=¶∆×÷π√✓©®:;?&.,\\-').replace(/[|\\{}()[\]^$+*?.\-\^]/g, '\\$&') + ']')

global.db = new Low(
    /https?:\/\//.test(opts['db'] || '') ? 
    new cloudDBAdapter(opts['db']) : /mongodb(\+srv)?:\/\//i.test(opts['db']) ? 
    (opts['mongodbv2'] ? new mongoDBV2(opts['db']) : new mongoDB(opts['db'])) : 
    new JSONFile(`${opts._[0] ? opts._[0] + '_' : ''}database.json`)
)

global.DATABASE = global.db
global.loadDatabase = async function loadDatabase() {
    if (global.db.READ) return new Promise((resolve) => setInterval(async function () {
        if (!global.db.READ) {
            clearInterval(this)
            resolve(global.db.data == null ? global.loadDatabase() : global.db.data)
        }
    }, 1 * 1000))
    if (global.db.data !== null) return
    global.db.READ = true
    await global.db.read().catch(console.error)
    global.db.READ = null
    global.db.data = {
        users: {},
        chats: {},
        stats: {},
        msgs: {},
        sticker: {},
        settings: {},
        ...(global.db.data || {})
    }
    global.db.chain = chain(global.db.data)
}
loadDatabase()

//-- إعدادات الجلسة (Session)
global.authFile = `sessions`
const {state, saveState, saveCreds} = await useMultiFileAuthState(global.authFile)
const msgRetryCounterMap = new Map()
const msgRetryCounterCache = new NodeCache({ stdTTL: 0, checkperiod: 0 })
const userDevicesCache = new NodeCache({ stdTTL: 0, checkperiod: 0 })
const {version} = await fetchLatestBaileysVersion()

const connectionOptions = {
    logger: pino({ level: 'silent' }),
    version,
    auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(
            state.keys,
            pino({ level: 'fatal' })
        ),
    },
    markOnlineOnConnect: true,
    generateHighQualityLinkPreview: true,
    msgRetryCounterCache,
    userDevicesCache,
    getMessage: async (key) => {
        let jid = jidNormalizedUser(key.remoteJid);
        let msg = await store.loadMessage(jid, key.id);
        return msg?.message || "";
    }
};

global.conn = makeWASocket(connectionOptions)
store.bind(conn)
conn.store = store

conn.ev.on('creds.update', saveCreds)

//-- نظام حقن طلب الكود التلقائي لمنصة Railway 🚀
if (!fs.existsSync(`./${authFile}/creds.json`)) {
    const askNumber = () => {
        return new Promise((resolve) => {
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            })
            rl.question('📲 لم يتم العثور على رقم محقن تلقائياً، يرجى إدخال رقم البوت مع رمز الدولة مباشرة (مثال: 96876430222): ', (num) => {
                rl.close()
                resolve(num.trim())
            })
        })
    }

    setTimeout(async () => {
        // جلب الرقم تلقائياً من config.js
        let phoneNumber = global.botNumber && global.botNumber[0] ? global.botNumber[0].replace(/[^0-9]/g, '') : ''
        
        // إذا لم يتم العثور على رقم محقن في الملف، يطلب من الكونسول كخيار احتياطي
        if (!phoneNumber) {
            phoneNumber = await askNumber()
        }

        // التحقق من صحة المدخلات
        if (!/^\d+$/.test(phoneNumber)) {
            console.log('❌ الرقم غير صحيح! يرجى إدخال أرقام فقط مع رمز الدولة بدون أي فواصل أو علامات.')
            process.exit(1)
        }

        console.log(chalk.bold.yellow(`⚙️ جاري توليد كود الربط تلقائياً للرقم المحقن: ${phoneNumber}...`))

        let code = await conn.requestPairingCode(phoneNumber)
        code = code?.match(/.{1,4}/g)?.join('-') || code

        console.log('\n')
        console.log(chalk.bold.cyan('╔══════════════════════════════════════╗'))
        console.log(chalk.bold.cyan('║        ⚙️ كود الربط والتحقق التلقائي ║'))
        console.log(chalk.bold.cyan('╚══════════════════════════════════════╝'))
        console.log('\n')

        // إطار الكود المولد
        console.log(chalk.bold.red('        ╔════════════════════╗'))
        console.log(chalk.bold.red('        ║') + chalk.bold.yellow(`     ${code}      `) + chalk.bold.red('║'))
        console.log(chalk.bold.red('        ╚════════════════════╝'))
        console.log('\n')

        console.log(chalk.bold.hex('#FFD700')('📱 خطوات ربط البوت بحسابك:\n'))
        console.log(chalk.hex('#00BFFF')('   1) ') + chalk.bold.green('افتح تطبيق الواتساب الخاص بك'))
        console.log(chalk.hex('#00BFFF')('   2) ') + chalk.bold.cyan('انتقل إلى الإعدادات ثم "الأجهزة المرتبطة"'))
        console.log(chalk.hex('#00BFFF')('   3) ') + chalk.bold.magenta('اضغط على "ربط جهاز" ثم اختر "الربط برقم الهاتف بدلاً من ذلك" ثم أدخل الكود أعلاه.'))
        console.log('\n')
    }, 3000)
}

conn.isInit = false

if (!opts['test']) {
    setInterval(async () => {
        if (global.db.data) await global.db.write().catch(console.error)
        if (opts['autocleartmp']) try {
            clearTmp()
        } catch (e) { console.error(e) }
    }, 60 * 1000)
}

/* دالة تنظيف الملفات المؤقتة */
async function clearTmp() {
    const tmp = [tmpdir(), join(__dirname, './tmp')]
    const filename = []
    tmp.forEach(dirname => readdirSync(dirname).forEach(file => filename.push(join(dirname, file))))
    
    return filename.map(file => {
        const stats = statSync(file)
        if (stats.isFile() && (Date.now() - stats.mtimeMs >= 1000 * 60 * 1)) return unlinkSync(file) // دقيقة واحدة
        return false
    })
}

setInterval(async () => {
    await clearTmp()
}, 60000) // دقيقة واحدة

async function connectionUpdate(update) {
    const { connection, lastDisconnect } = update
    
    if (connection === 'close') {
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
        if (shouldReconnect) {
            console.log('♻️ جاري إعادة الاتصال تلقائياً...')
            global.reloadHandler(true)
        } else {
            console.log('❌ تم إغلاق الجلسة نهائياً. يرجى حذف مجلد الـ sessions وإعادة المسح المباشر.')
        }
    }
    
    if (connection === 'open') {
        console.log('🟢 تم اتصال البوت بنجاح! جاهز لتلقي الأوامر.')
    }
}

process.on('uncaughtException', console.error)

let isInit = true;
let handler = await import('./handler.js')
global.reloadHandler = async function (restatConn) {
    try {
        const Handler = await import(`./handler.js?update=${Date.now()}`).catch(console.error)
        if (Object.keys(Handler || {}).length) handler = Handler
    } catch (e) {
        console.error(e)
    }
    
    if (restatConn) {
        try { global.conn.ws.close() } catch {}
        conn.ev.removeAllListeners()
        
        global.conn = makeWASocket(connectionOptions)
        store.bind(global.conn)
        global.conn.store = store
        global.conn.ev.on('creds.update', saveCreds)
        isInit = true
    }
    
    if (!isInit) {
        conn.ev.off('messages.upsert', conn.handler)
        conn.ev.off('group-participants.update', conn.participantsUpdate)
        conn.ev.off('groups.update', conn.groupsUpdate)
        conn.ev.off('message.delete', conn.onDelete)
        conn.ev.off('connection.update', conn.connectionUpdate)
        conn.ev.off('creds.update', conn.credsUpdate)
    }
    
    // نصوص الإشعارات الافتراضية المحدثة والمعربة بالكامل للحقوق الجديدة
    conn.welcome = 'أهلاً بك يا @user\nمرحباً بك في مجموعة @group ✨'
    conn.bye = 'وداعاً يا @user 👋'
    conn.spromote = '🛡️ تم ترقية العضو @user ليصبح مشرفاً في المجموعة'
    conn.sdemote = '📉 تم تنزيل العضو @user من رتبة الإشراف'
    conn.sDesc = '📝 *تم تعديل وصف المجموعة إلى:*\n\n@desc'
    conn.sSubject = '📢 *تم تغيير اسم المجموعة إلى:*\n\n@group'
    conn.sIcon = '🖼️ *تم تحديث الصورة الشخصية للمجموعة.*'
    conn.sRevoke = '🔗 *تم إعادة تعيين رابط المجموعة بنجاح:*\n\n@revoke'
    
    conn.handler = handler.handler.bind(global.conn)
    conn.participantsUpdate = handler.participantsUpdate.bind(global.conn)
    conn.groupsUpdate = handler.groupsUpdate.bind(global.conn)
    conn.connectionUpdate = connectionUpdate.bind(global.conn)
    conn.credsUpdate = saveCreds.bind(global.conn, true)
    
    conn.ev.on('messages.upsert', conn.handler)
    conn.ev.on('group-participants.update', conn.participantsUpdate)
    conn.ev.on('groups.update', conn.groupsUpdate)
    conn.ev.on('connection.update', conn.connectionUpdate)
    conn.ev.on('creds.update', conn.credsUpdate)
    conn.ev.on('messages.update', async (updates) => {
        for (const update of updates) {
            try {
                await handler.deleteUpdate.call(conn, update)
            } catch (e) {
                console.error('خطأ في استقبال مستمع الحذف:', e)
            }
        }
    })
    isInit = false
    return true
}

const pluginFolder = global.__dirname(join(__dirname, './plugins/index'))
const pluginFilter = filename => /\.js$/.test(filename)
global.plugins = {}

async function filesInit() {
    const start = Date.now()
    let ok = 0
    let fail = 0
    
    for (let filename of readdirSync(pluginFolder).filter(pluginFilter)) {
        try {
            let file = global.__filename(join(pluginFolder, filename))
            const module = await import(file)
            global.plugins[filename] = module.default || module
            ok++
        } catch (e) {
            console.log(chalk.red(`❌ خطأ برمي في ملف الأوامر ${filename}`))
            fail++
            delete global.plugins[filename]
        }
    }
    
    const end = Date.now()
    console.log(
        chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━') + '\n' +
        chalk.white('📦 الملحقات (Plugins) المكتشفة: ') + chalk.bold(ok + fail) + '\n' +
        chalk.green('🟢 الملفات السليمة: ') + chalk.bold.green(ok) + '\n' +
        chalk.red('🔴 ملفات بها أخطاء: ') + chalk.bold.red(fail) + '\n' +
        chalk.magenta('⚡ زمن الاستجابة والتحميل: ') + chalk.bold.magenta(`${end - start}ms`) + '\n' +
        chalk.cyan.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━')
    )
}
filesInit()

process.on('unhandledRejection', (err) => {
    console.error('خطأ غير معالج بالجملة:', err)
})

global.reload = async (_ev, filename) => {
    if (!pluginFilter(filename)) return
    const start = Date.now()
    const filePath = join(pluginFolder, filename)
    const dir = global.__filename(filePath, true)
    const isExisting = filename in global.plugins
    const exists = existsSync(dir)
    
    try {
        if (!exists) {
            if (isExisting) {
                delete global.plugins[filename]
                console.log(chalk.red(`🗑️ تم حذف ملف الملحق الحالي ← ${filename}`))
            }
            return
        }
        
        const code = readFileSync(dir, 'utf8')
        const err = syntaxerror(code, filename, {
            sourceType: 'module',
            allowAwaitOutsideFunction: true
        })
        
        if (err) {
            const { line, column, message } = err
            const lines = code.split('\n')
            const errorLine = lines[line - 1]
            console.log(
                chalk.red.bold(`❌ خطأ بناء وسينتكس في ملف ${filename}`) +
                `\n${chalk.yellow(`📍 السطر: ${line}, العمود: ${column}`)}` +
                `\n${chalk.gray(message)}` +
                `\n\n${chalk.white(errorLine)}` +
                `\n${' '.repeat(column - 1)}${chalk.red('^')}`
            )
            return
        }
        
        const module = await import(`${global.__filename(dir)}?update=${Date.now()}`)
        global.plugins[filename] = module.default || module
        const end = Date.now()
        
        if (isExisting) {
            console.log(
                chalk.cyan(`♻️ تم تحديث وإعادة تحميل الملحق بنجاح → ${filename}`) +
                chalk.gray(` (${end - start}ms)`)
            )
        } else {
            console.log(
                chalk.green(`✨ إضافة أمر وملحق جديد تماماً → ${filename}`) +
                chalk.gray(` (${end - start}ms)`)
            )
        }
    } catch (e) {
        console.log(
            chalk.red.bold(`❌ خطأ أثناء استيراد الملف ${filename}`) +
            '\n' +
            chalk.gray(e.message)
        )
    } finally {
        global.plugins = Object.fromEntries(
            Object.entries(global.plugins).sort(([a], [b]) => a.localeCompare(b))
        )
    }
}

Object.freeze(global.reload)
watch(pluginFolder, global.reload)
await global.reloadHandler()

async function _quickTest() {
    const start = Date.now()
    const check = (cmd, args = []) => {
        return new Promise(resolve => {
            const p = spawn(cmd, args)
            p.on('close', code => resolve(code !== 127))
            p.on('error', () => resolve(false))
        })
    }
    
    const [ffmpeg, ffmpegWebp, convert, magick, gm] = await Promise.all([
        check('ffmpeg'),
        check('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-filter_complex', 'color', '-frames:v', '1', '-f', 'webp', '-']),
        check('convert'),
        check('magick'),
        check('gm')
    ])
    
    const imageMagick = convert || magick || gm
    global.support = Object.freeze({
        ffmpeg,
        ffmpegWebp,
        imageMagick
    })
    
    const end = Date.now()
    console.log(
        chalk.cyan.bold('━━━━━━━━━━━━━━━━━━━━━━') + '\n' +
        chalk.yellow.bold('🔎 فحص متطلبات النظام والأدوات') + '\n' +
        chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━') + '\n' +
        `🎬 أداة الفيديو FFmpeg : ${ffmpeg ? chalk.green('✔ جاهز ومعرف') : chalk.red('✖ غير متوفر')}\n` +
        `🖼 ميزة ملصقات الـ WebP  : ${ffmpegWebp ? chalk.green('✔ مدعوم') : chalk.red('✖ فاشل/غير مدعوم')}\n` +
        `🧰 معالج الصور ومؤثراتها: ${imageMagick ? chalk.green('✔ جاهز ومعرف') : chalk.red('✖ غير متوفر')}\n` +
        chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━') + '\n' +
        chalk.magenta(`⚡ الوقت المستغرق: ${end - start}ms`) + '\n' +
        chalk.cyan.bold('━━━━━━━━━━━━━━━━━━━━━━')
    )
    
    if (!ffmpeg) conn.logger.warn('تحذير: يرجى تثبيت أداة FFmpeg لتتمكن من إرسال ومعالجة مقاطع الفيديو داخل البوت.')
    if (ffmpeg && !ffmpegWebp) conn.logger.warn('تحذير: أداة FFmpeg تفتقد لمكتبة ربط الصور المتحركة (قد تفشل صناعة ملصقات الفيديو المتكررة).')
    if (!imageMagick) conn.logger.warn('تحذير: يرجى تثبيت أداة ImageMagick لتفعيل ميزات تحويل الصور وصناعة الملصقات التلقائية بالكامل.')
}

_quickTest()
.then(() => console.log('✅ تم الانتهاء من الفحص السريع التلقائي للنظام بنجاح!'))
.catch(console.error)
