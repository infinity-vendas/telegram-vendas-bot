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
// WEBHOOK MP
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

📦 Produto:
${info.produto}

💰 Valor:
R$ ${info.valor}

👤 Vendedor:
${info.vendedor}

🔗 Link:
${info.link}`
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
✅ SUPORTE 24H`
}
    );

    await bot.sendMessage(
      chatId,
`📋 MENU`,
{
  reply_markup: {
    inline_keyboard: [

      [{
        text: "📦 Produtos",
        callback_data: "menu_produtos"
      }],

      [{
        text: "📲 Suporte",
        url:
`https://wa.me/${WHATSAPP}`
      }],

      [{
        text: "🔗 Meu Link",
        url:
`https://t.me/${BOT_USERNAME}`
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
/listar_produtos
/del_produto ID
/del_todos

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
    step: "produto"
  };

  bot.sendMessage(
    msg.chat.id,
    "📦 Nome do produto:"
  );
});

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
👤 ${p.vendedor}

`;
    });

    bot.sendMessage(
      msg.chat.id,
      texto
    );
  }
);

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
// DELETE TODOS
// =========================================

bot.onText(
  /\/del_todos/,
  async (msg) => {

    const id = String(msg.from.id);

    if (
      id !== MASTER
    ) return;

    const snap = await db
      .collection('produtos')
      .get();

    for (const doc of snap.docs) {

      await db
        .collection('produtos')
        .doc(doc.id)
        .delete();
    }

    bot.sendMessage(
      msg.chat.id,
      "🗑 Todos produtos deletados"
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
`📦 ${p.nome}

💰 R$ ${p.preco}

📝 ${p.desc}

👤 Vendedor:
${p.vendedor}`,
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

            vendedor:
p.vendedor,

            link:
p.link,

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

⏳ Aguardando pagamento...`
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

      // =====================================
      // PRODUTO
      // =====================================

      if (state.step === "produto") {

        state.nome = text;

        state.step = "valor";

        return bot.sendMessage(
          msg.chat.id,
          "💰 Valor:"
        );
      }

      // =====================================
      // VALOR
      // =====================================

      if (state.step === "valor") {

        state.preco = Number(
          text.replace(",", ".")
        );

        state.step = "descricao";

        return bot.sendMessage(
          msg.chat.id,
          "📝 Descrição:"
        );
      }

      // =====================================
      // DESCRIÇÃO
      // =====================================

      if (state.step === "descricao") {

        state.desc = text;

        state.step = "vendedor";

        return bot.sendMessage(
          msg.chat.id,
          "👤 Vendedor:"
        );
      }

      // =====================================
      // VENDEDOR
      // =====================================

      if (state.step === "vendedor") {

        state.vendedor = text;

        state.step = "link";

        return bot.sendMessage(
          msg.chat.id,
          "🔗 Link produto:"
        );
      }

      // =====================================
      // LINK
      // =====================================

      if (state.step === "link") {

        await db
          .collection('produtos')
          .add({

            nome:
state.nome,

            preco:
state.preco,

            desc:
state.desc,

            vendedor:
state.vendedor,

            link:
text,

            createdAt:
Date.now()
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
