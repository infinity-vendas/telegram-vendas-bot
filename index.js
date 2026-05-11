require('dotenv').config();

const express = require('express');
const TelegramBot = require('node-telegram-bot-api');

const {
  MercadoPagoConfig,
  Payment
} = require('mercadopago');

const {
  initializeApp,
  cert
} = require('firebase-admin/app');

const {
  getFirestore
} = require('firebase-admin/firestore');

// =========================================
// EXPRESS
// =========================================

const app = express();

app.use(express.json());

// =========================================
// CONFIG
// =========================================

const MASTER = "6863505946";

const ADMINS = [
  "8510878195"
];

const WHATSAPP = "551981528372";

const BOT_USERNAME = "SellForge_bot";

const LOGO =
"https://i.postimg.cc/g2JJvqHN/logo.jpg";

let BOT_ATIVO = true;

const userState = {};

// =========================================
// VALIDAÇÕES
// =========================================

if (!process.env.BOT_TOKEN)
  throw new Error("BOT_TOKEN ausente");

if (!process.env.MP_ACCESS_TOKEN)
  throw new Error("MP_ACCESS_TOKEN ausente");

if (!process.env.RENDER_EXTERNAL_URL)
  throw new Error("RENDER_EXTERNAL_URL ausente");

if (!process.env.FIREBASE_CONFIG)
  throw new Error("FIREBASE_CONFIG ausente");

// =========================================
// MERCADO PAGO
// =========================================

const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN
});

const mpPayment = new Payment(mpClient);

// =========================================
// FIREBASE
// =========================================

const serviceAccount = JSON.parse(
  process.env.FIREBASE_CONFIG
);

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

console.log("🔥 Firebase conectado");

// =========================================
// TELEGRAM
// =========================================

const bot = new TelegramBot(
  process.env.BOT_TOKEN,
  {
    webHook: true
  }
);

const SECRET_PATH =
`/bot${process.env.BOT_TOKEN}`;

app.post(
  SECRET_PATH,
  async (req, res) => {

    try {

      await bot.processUpdate(req.body);

      res.sendStatus(200);

    } catch (err) {

      console.log(err);

      res.sendStatus(500);
    }
  }
);

// =========================================
// HOME
// =========================================

app.get('/', (req, res) => {
  res.send("🚀 BOT ONLINE");
});

// =========================================
// WEBHOOK MERCADO PAGO
// =========================================

app.post('/webhook/mp', async (req, res) => {

  try {

    const data = req.body;

    if (data.type !== "payment")
      return res.sendStatus(200);

    const payment =
      await mpPayment.get({
        id: data.data.id
      });

    if (payment.status !== "approved")
      return res.sendStatus(200);

    const vendaRef = db
      .collection('pagamentos')
      .doc(String(payment.id));

    const venda = await vendaRef.get();

    if (!venda.exists)
      return res.sendStatus(200);

    const info = venda.data();

    if (info.aprovado)
      return res.sendStatus(200);

    await vendaRef.update({
      aprovado: true,
      status: "approved"
    });

    await bot.sendMessage(
      info.chatId,
`✅ PAGAMENTO APROVADO!

📦 ${info.produto}

💰 R$ ${info.valor}

📲 Finalize:
https://wa.me/${info.whatsapp}`
    );

    res.sendStatus(200);

  } catch (err) {

    console.log(err);

    res.sendStatus(500);
  }
});

// =========================================
// START
// =========================================

bot.onText(/\/start/, async (msg) => {

  try {

    const chatId = msg.chat.id;

    const id = String(msg.from.id);

    await bot.sendPhoto(
      chatId,
      LOGO,
{
  caption:
`🚀 INFINITY CLIENTES

🤖 Sistema automático

✅ PIX AUTOMÁTICO
✅ ENTREGA AUTOMÁTICA
✅ SUPORTE 24H

Escolha abaixo 👇`,
  reply_markup: {
    inline_keyboard: [

      [{
        text: "📦 Produtos",
        callback_data: "menu_produtos"
      }],

      [{
        text: "📊 Planos",
        callback_data: "menu_planos"
      }],

      [{
        text: "🤖 Alugar Bot",
        callback_data: "menu_bot"
      }],

      [{
        text: "📲 Suporte",
        callback_data: "menu_suporte"
      }],

      [{
        text: "🔗 Meu Link",
        callback_data: "menu_link"
      }]
    ]
  }
}
    );

    if (
      id === MASTER ||
      ADMINS.includes(id)
    ) {

      await bot.sendMessage(
        chatId,
`🔐 ADMIN

/comandos_admin`
      );
    }

  } catch (err) {

    console.log(err);
  }
});

// =========================================
// ADMIN
// =========================================

bot.onText(/\/comandos_admin/, async (msg) => {

  const id = String(msg.from.id);

  if (
    id !== MASTER &&
    !ADMINS.includes(id)
  ) return;

  bot.sendMessage(
    msg.chat.id,
`🔐 PAINEL ADMIN

/add_produto
/del_produto ID
/listar_produtos

👑 MASTER

/desligar_bot
/ligar_bot`
  );
});

// =========================================
// ADD PRODUTO
// =========================================

bot.onText(/\/add_produto/, async (msg) => {

  const id = String(msg.from.id);

  if (
    id !== MASTER &&
    !ADMINS.includes(id)
  ) return;

  userState[id] = {
    step: "nome"
  };

  bot.sendMessage(
    msg.chat.id,
    "📦 Nome do produto:"
  );
});

// =========================================
// DELETE PRODUTO
// =========================================

bot.onText(
  /\/del_produto (.+)/,
  async (msg, match) => {

    const id = String(msg.from.id);

    if (
      id !== MASTER &&
      !ADMINS.includes(id)
    ) return;

    await db
      .collection('produtos')
      .doc(match[1])
      .delete();

    bot.sendMessage(
      msg.chat.id,
      "🗑 Produto deletado"
    );
  }
);

// =========================================
// LISTAR PRODUTOS
// =========================================

bot.onText(
  /\/listar_produtos/,
  async (msg) => {

    const id = String(msg.from.id);

    if (
      id !== MASTER &&
      !ADMINS.includes(id)
    ) return;

    const snap = await db
      .collection('produtos')
      .get();

    if (snap.empty) {

      return bot.sendMessage(
        msg.chat.id,
        "❌ Nenhum produto"
      );
    }

    let texto =
"📦 PRODUTOS\n\n";

    snap.forEach(doc => {

      const p = doc.data();

      texto +=
`ID: ${doc.id}

📦 ${p.nome}
💰 R$ ${p.preco}

`;
    });

    bot.sendMessage(
      msg.chat.id,
      texto
    );
  }
);

// =========================================
// BOT ON/OFF
// =========================================

bot.onText(/\/desligar_bot/, (msg) => {

  if (
    String(msg.from.id) !== MASTER
  ) return;

  BOT_ATIVO = false;

  bot.sendMessage(
    msg.chat.id,
    "🔴 BOT DESLIGADO"
  );
});

bot.onText(/\/ligar_bot/, (msg) => {

  if (
    String(msg.from.id) !== MASTER
  ) return;

  BOT_ATIVO = true;

  bot.sendMessage(
    msg.chat.id,
    "🟢 BOT LIGADO"
  );
});

// =========================================
// CALLBACKS
// =========================================

bot.on(
  "callback_query",
  async (q) => {

    try {

      await bot.answerCallbackQuery(q.id);

      const data = q.data;

      // =====================================
      // PRODUTOS
      // =====================================

      if (data === "menu_produtos") {

        const snap = await db
          .collection('produtos')
          .get();

        if (snap.empty) {

          return bot.sendMessage(
            q.message.chat.id,
            "❌ Nenhum produto cadastrado"
          );
        }

        for (const doc of snap.docs) {

          const p = doc.data();

          await bot.sendMessage(
            q.message.chat.id,
`📦 ${p.nome || "Sem nome"}

💰 R$ ${p.preco || 0}

📝 ${p.desc || "Sem descrição"}

⚠️ Aprovação PIX pode levar até 2 minutos.`,
{
  reply_markup: {
    inline_keyboard: [[{
      text: "🛒 Comprar",
      callback_data:
`buy_${doc.id}`
    }]]
  }
}
          );
        }
      }

      // =====================================
      // PLANOS
      // =====================================

      if (data === "menu_planos") {

        return bot.sendMessage(
          q.message.chat.id,
`📊 PLANOS

1D = R$5
3D = R$15
10D = R$30
20D = R$60
30D = R$90`
        );
      }

      // =====================================
      // ALUGAR BOT
      // =====================================

      if (data === "menu_bot") {

        return bot.sendMessage(
          q.message.chat.id,
`🤖 ALUGAR BOT

24h = R$6
48h = R$8`,
{
  reply_markup: {
    inline_keyboard: [[{
      text: "📲 Contratar",
      url:
`https://wa.me/${WHATSAPP}`
    }]]
  }
});
      }

      // =====================================
      // SUPORTE
      // =====================================

      if (data === "menu_suporte") {

        return bot.sendMessage(
          q.message.chat.id,
`📲 SUPORTE`,
{
  reply_markup: {
    inline_keyboard: [[{
      text: "WhatsApp",
      url:
`https://wa.me/${WHATSAPP}`
    }]]
  }
});
      }

      // =====================================
      // LINK
      // =====================================

      if (data === "menu_link") {

        return bot.sendMessage(
          q.message.chat.id,
`🔗 https://t.me/${BOT_USERNAME}`
        );
      }

      // =====================================
      // PIX
      // =====================================

      if (data.startsWith("buy_")) {

        const idProduto =
          data.replace(
            "buy_",
            ""
          );

        const doc = await db
          .collection('produtos')
          .doc(idProduto)
          .get();

        if (!doc.exists) {

          return bot.sendMessage(
            q.message.chat.id,
            "❌ Produto não encontrado"
          );
        }

        const p = doc.data();

        const payment =
await mpPayment.create({
  body: {

    transaction_amount:
Number(p.preco),

    description:
p.nome,

    payment_method_id:
"pix",

    notification_url:
`${process.env.RENDER_EXTERNAL_URL}/webhook/mp`,

    payer: {
      email:
"cliente@email.com"
    }
  }
});

        const qr =
payment
.point_of_interaction
.transaction_data
.qr_code_base64;

        const copia =
payment
.point_of_interaction
.transaction_data
.qr_code;

        await db
          .collection('pagamentos')
          .doc(
String(payment.id)
          )
          .set({

            chatId:
q.message.chat.id,

            produto:
p.nome,

            valor:
p.preco,

            whatsapp:
p.whatsapp,

            aprovado:
false
          });

        await bot.sendPhoto(
          q.message.chat.id,
          Buffer.from(
qr,
'base64'
          ),
{
  caption:
`💰 PAGAMENTO PIX

📦 ${p.nome}

💲 R$ ${p.preco}

📋 PIX COPIA E COLA:

${copia}

⏳ Aguardando pagamento...

⚠️ Aprovação pode levar até 2 minutos.`
}
        );
      }

    } catch (err) {

      console.log(err);
    }
  }
);

// =========================================
// FLUXO ADD PRODUTO
// =========================================

bot.on(
  "message",
  async (msg) => {

    try {

      if (!msg.text) return;

      const id =
String(msg.from.id);

      const text =
msg.text;

      const state =
userState[id];

      if (text.startsWith("/"))
        return;

      if (!state)
        return;

      if (state.step === "nome") {

        state.nome = text;

        state.step = "preco";

        return bot.sendMessage(
          msg.chat.id,
          "💰 Valor:"
        );
      }

      if (state.step === "preco") {

        state.preco = Number(
          text
            .replace(",", ".")
        );

        state.step = "desc";

        return bot.sendMessage(
          msg.chat.id,
          "📝 Descrição:"
        );
      }

      if (state.step === "desc") {

        state.desc = text;

        state.step = "zap";

        return bot.sendMessage(
          msg.chat.id,
          "📲 WhatsApp:"
        );
      }

      if (state.step === "zap") {

        await db
          .collection('produtos')
          .add({

            nome:
state.nome,

            preco:
state.preco,

            desc:
state.desc,

            whatsapp:
text
          });

        userState[id] = null;

        return bot.sendMessage(
          msg.chat.id,
          "✅ Produto adicionado"
        );
      }

    } catch (err) {

      console.log(err);
    }
  }
);

// =========================================
// SERVER
// =========================================

const PORT =
process.env.PORT || 3000;

app.listen(
  PORT,
  async () => {

    console.log(
`🚀 ONLINE ${PORT}`
    );

    const webhook =
`${process.env.RENDER_EXTERNAL_URL}${SECRET_PATH}`;

    await bot.setWebHook(
      webhook
    );

    console.log(
"✅ WEBHOOK SETADO"
    );

    console.log(webhook);
  }
);
