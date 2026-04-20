const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const admin = require("firebase-admin");

const TOKEN = "8227400926:AAF5sWBB6n63wZueUo_XQBVSgs6lBGLsAiE";
const URL = "https://telegram-vendas-bot-1.onrender.com";
const ADMINS = ["6863505946"];

const serviceAccount = require("./firebase.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const bot = new TelegramBot(TOKEN, { webHook: true });
const app = express();

app.use(express.json());

app.post("/webhook", (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// ================= IDENTIDADE =================
const OWNER = "Faelzin Vendas";
const BOT_VERSION = "v1";

// ================= WHATSAPP =================
const WHATSAPP_NUMBER = "5551981528372";

// ================= PIX =================
const PIX_KEY = "51981528372";
const CPF_MASK = "060***31**";

// ================= CONTROLES =================
const deleteConfirm = {};
const addStep = {};
const addData = {};

// ================= MENU =================
const MENU_TEXT = `⬛⬛⬛ INFINITY STORE ⬛⬛⬛

━━━━━━━━━━━━━━━━━━

💎 BEM-VINDO AO SISTEMA VIP

⚡ /produtos
⚡ /addproduto
⚡ /deletarprodutos
⚡ /status

━━━━━━━━━━━━━━━━━━`;

// ================= START NOVO LAYOUT =================
const START_TEXT = `Dono: INFINITY CLIENTE
Validity: 25,00
Created by: @Infity_cliente_oficial

Parcerias: nenhuma
Vendedores (1): admin
Divulgadores: nenhum

Facebook: indisponível
Instagram: disponível
YouTube: Em Breve
TikTok: indisponível
Kwai: indisponível
Patrocinadores: nenhum

━━━━━━━━━━━━━━━━━━

💰 Aceitamos pagamento Pix / cartão: em breve!
🔐 Transações 100% manual e seguras
⚠️ Compre somente comigo atualmente!

🤝 Unidos, fortes venceremos!`;

// ================= START =================
bot.onText(/\/start/, async (msg) => {

  const chatId = msg.chat.id;

  // envia layout atualizado
  bot.sendMessage(chatId, START_TEXT);

  // libera menu depois de 5 segundos
  setTimeout(() => {
    bot.sendMessage(chatId, MENU_TEXT);
  }, 5000);
});

// ================= BOTÃO COMPRA =================
function buyButton(nome, valor) {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "🛒 Adquirir agora",
            callback_data: `buy_${nome}_${valor}`
          }
        ]
      ]
    }
  };
}

// ================= PRODUTOS =================
bot.onText(/\/produtos/, async (msg) => {

  const snap = await db.collection("produtos").get();

  if (snap.empty) {
    return bot.sendMessage(msg.chat.id, "⚡ Nenhum produto disponível");
  }

  snap.forEach((d) => {
    const p = d.data();

    const text =
`⚡ ${p.nome}

💰 Valor: R$ ${p.valor}
📦 ${p.descricao}
`;

    bot.sendMessage(
      msg.chat.id,
      text,
      buyButton(p.nome, p.valor)
    );
  });
});

// ================= COMPRA =================
bot.on("callback_query", async (query) => {

  const data = query.data;
  const chatId = query.message.chat.id;

  if (!data.startsWith("buy_")) return;

  const parts = data.split("_");
  const nome = parts[1];
  const valor = parts[2];

  await bot.sendMessage(chatId,
`⚡ PRODUTO SELECIONADO

📦 Produto: ${nome}
💰 Valor: R$ ${valor}

━━━━━━━━━━━━━━

🔐 CHAVE PIX: ${PIX_KEY}
📄 CPF: ${CPF_MASK}

━━━━━━━━━━━━━━

📩 Envie o comprovante no WhatsApp e aguarde liberação!`);

  const msgWhats = encodeURIComponent(
`Olá! Quero finalizar meu pedido:

📦 Produto: ${nome}
💰 Valor: R$ ${valor}

Segue comprovante para análise.`
  );

  setTimeout(() => {
    bot.sendMessage(chatId,
`👇 WhatsApp:`,
{
  reply_markup: {
    inline_keyboard: [
      [
        {
          text: "📲 Enviar comprovante",
          url: `https://wa.me/${WHATSAPP_NUMBER}?text=${msgWhats}`
        }
      ]
    ]
  }
});
  }, 2000);
});

// ================= ADD PRODUTO =================
bot.onText(/\/addproduto/, (msg) => {

  if (!ADMINS.includes(String(msg.from.id))) {
    return bot.sendMessage(msg.chat.id, "⚡ Sem permissão");
  }

  addStep[msg.from.id] = "nome";
  bot.sendMessage(msg.chat.id, "⚡ Nome do produto:");
});

// ================= FLUXO ADMIN =================
bot.on("message", async (msg) => {

  const id = msg.from.id;
  const text = msg.text;

  if (!text || text.startsWith("/")) return;

  if (addStep[id]) {

    if (!addData[id]) addData[id] = {};

    if (addStep[id] === "nome") {
      addData[id].nome = text;
      addStep[id] = "valor";
      return bot.sendMessage(msg.chat.id, "⚡ Valor:");
    }

    if (addStep[id] === "valor") {
      addData[id].valor = text;
      addStep[id] = "descricao";
      return bot.sendMessage(msg.chat.id, "⚡ Descrição:");
    }

    if (addStep[id] === "descricao") {
      addData[id].descricao = text;

      await db.collection("produtos").add(addData[id]);

      delete addStep[id];
      delete addData[id];

      return bot.sendMessage(msg.chat.id, "⚡ Produto adicionado com sucesso!");
    }
  }

  if (deleteConfirm[id]) {

    if (text == deleteConfirm[id]) {

      const snap = await db.collection("produtos").get();
      const batch = db.batch();

      snap.forEach(doc => batch.delete(doc.ref));
      await batch.commit();

      delete deleteConfirm[id];

      return bot.sendMessage(msg.chat.id, "⚡ Produtos deletados com sucesso!");
    }

    return bot.sendMessage(msg.chat.id, "⚡ Código inválido");
  }
});

// ================= DELETE PRODUTOS =================
bot.onText(/\/deletarprodutos/, async (msg) => {

  if (!ADMINS.includes(String(msg.from.id))) {
    return bot.sendMessage(msg.chat.id, "⚡ Sem permissão");
  }

  const code = Math.floor(10000 + Math.random() * 90000);

  deleteConfirm[msg.from.id] = code;

  bot.sendMessage(msg.chat.id,
`⚠️ CONFIRMAÇÃO

Código: ${code}

Digite para confirmar exclusão total`);
});

// ================= STATUS =================
bot.onText(/\/status/, (msg) => {
  bot.sendMessage(msg.chat.id,
`⚡ Bot online
⚡ DEV: ${OWNER}
⚡ versão: ${BOT_VERSION}`);
});

// ================= SERVER =================
app.listen(process.env.PORT || 3000, async () => {
  await bot.setWebHook(`${URL}/webhook`);
  console.log("⚡ BOT START ATUALIZADO COM NOVO LAYOUT");
});
