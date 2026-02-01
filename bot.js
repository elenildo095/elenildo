
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys")
const cron = require("node-cron")
const fs = require("fs")

// ====== ARQUIVOS DE DADOS ======
const goldPath = "./gold.json"
const blacklistPath = "./blacklist.json"

if (!fs.existsSync(goldPath)) fs.writeFileSync(goldPath, JSON.stringify({}))
if (!fs.existsSync(blacklistPath)) fs.writeFileSync(blacklistPath, JSON.stringify([]))

const gold = JSON.parse(fs.readFileSync(goldPath))
const blacklist = JSON.parse(fs.readFileSync(blacklistPath))

function salvarGold() {
    fs.writeFileSync(goldPath, JSON.stringify(gold, null, 2))
}

function salvarBlacklist() {
    fs.writeFileSync(blacklistPath, JSON.stringify(blacklist, null, 2))
}

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("auth_info")

    const sock = makeWASocket({ auth: state })

    sock.ev.on("creds.update", saveCreds)

    // ====== BEM-VINDO + ANTI BLACKLIST ======
    sock.ev.on("group-participants.update", async (update) => {
        if (update.action === "add") {
            for (let user of update.participants) {

                if (blacklist.includes(user)) {
                    await sock.groupParticipantsUpdate(update.id, [user], "remove")
                    continue
                }

                await sock.sendMessage(update.id, {
                    text: `🌸 Bem-vindo(a) ao grupo de doramas! 💖`,
                    mentions: [user]
                })
            }
        }
    })

    // ====== MENSAGENS ======
    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0]
        if (!msg.message || msg.key.fromMe) return

        const from = msg.key.remoteJid
        const sender = msg.key.participant || msg.key.remoteJid
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text
        if (!text) return

        const lower = text.toLowerCase()

        // ====== SISTEMA GOLD ======
        if (!gold[sender]) gold[sender] = 0
        gold[sender] += 1
        salvarGold()

        if (gold[sender] === 50) {
            await sock.sendMessage(from, {
                text: `🌟 @${sender.split("@")[0]} virou membro GOLD!`,
                mentions: [sender]
            })
        }

        // ====== COMANDOS ======
        if (lower === "!marcar") {
            const meta = await sock.groupMetadata(from)
            const membros = meta.participants.map(p => p.id)
            await sock.sendMessage(from, { text: "📣 Atenção dorameiros!", mentions: membros })
        }

        if (lower === "!admins") {
            const meta = await sock.groupMetadata(from)
            const admins = meta.participants.filter(p => p.admin).map(p => p.id)
            await sock.sendMessage(from, { text: "👑 Chamando os ADMs!", mentions: admins })
        }

        if (lower.startsWith("!banir ")) {
            const numero = lower.split(" ")[1] + "@s.whatsapp.net"
            blacklist.push(numero)
            salvarBlacklist()
            await sock.groupParticipantsUpdate(from, [numero], "remove")
        }

        // ====== ANTI LINK ======
        if (lower.includes("chat.whatsapp.com")) {
            await sock.sendMessage(from, { text: "🚫 Links de outros grupos não são permitidos!" })
            await sock.sendMessage(from, { delete: msg.key })
        }
    })

    // ====== ABRIR/FECHAR GRUPO AUTOMÁTICO ======
    const GROUP_ID = "COLOQUE_ID_DO_GRUPO_AQUI@g.us"

    cron.schedule("0 23 * * *", async () => {
        await sock.groupSettingUpdate(GROUP_ID, "announcement")
    })

    cron.schedule("0 8 * * *", async () => {
        await sock.groupSettingUpdate(GROUP_ID, "not_announcement")
    })
}

startBot()

process.on("uncaughtException", console.error)
process.on("unhandledRejection", console.error)
