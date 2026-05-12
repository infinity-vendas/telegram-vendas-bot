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

app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));

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

    console.log("📩 WEBHOOK:", data);

    if (data.type !== "payment")
      return res.sendStatus(200);

    const payment =
      await mpPayment.get({
        id: data.data.id
      });

    console.log("💰 PAGAMENTO:", payment);

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

━━━━━━━━━━━━━━━━━━━

📦 Produto:
${info.produto}

💰 Valor:
R$ ${info.valor}

👤 WhatsApp:
${info.whatsapp}

🔗 Link:
${info.link}

━━━━━━━━━━━━━━━━━━━

🚀 Obrigado pela compra!`
    );

    res.sendStatus(200);

  } catch (err) {

    console.log("❌ ERRO WEBHOOK:", err);

    res.sendStatus(500);
  }
});

// =========================================
// START
// =========================================

bot.onText(/\/start/, async (msg) => {

  try {

    const chatId = msg.chat.id;

    const userId =
    String(msg.from.id);

    await bot.sendPhoto(
      chatId,
      LOGO
    );

    await bot.sendMessage(
      chatId,
`🚀 Olá, seja bem-vindo(a)!

Você está na INFINITY CLIENTES.

✅ Produtos digitais
✅ PIX automático
✅ Aprovação automática
✅ Entrega automática
✅ Suporte rápido

━━━━━━━━━━━━━━━━━━━

⚠️ Não caia em golpes.
Compre apenas pelo canal oficial.

━━━━━━━━━━━━━━━━━━━

💳 Pagamento seguro via Mercado Pago

👇 Escolha uma opção abaixo`,
{
  reply_markup: {
    inline_keyboard: [

      [
        {
          text: "📦 PRODUTOS",
          callback_data: "menu_produtos"
        }
      ],

      [
        {
          text: "ℹ️ INFORMAÇÕES",
          callback_data: "menu_info"
        }
      ],

      [
        {
          text: "📲 SUPORTE",
          url:
`https://wa.me/${WHATSAPP}`
        }
      ]
    ]
  }
}
    );

    // ADMIN

    if (
      userId === MASTER ||
      ADMINS.includes(userId)
    ) {

      await bot.sendMessage(
        chatId,
`🔐 PAINEL ADMIN`,
{
  reply_markup: {
    inline_keyboard: [

      [
        {
          text: "➕ ADD PRODUTO",
          callback_data: "admin_add"
        }
      ],

      [
        {
          text: "📦 LISTAR",
          callback_data: "admin_listar"
        }
      ],

      [
        {
          text: "🗑 LIMPAR",
          callback_data: "admin_limpar"
        }
      ]
    ]
  }
}
      );
    }

  } catch (err) {

    console.log(err);
  }
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

      const userId =
      String(q.from.id);

      // =====================================
      // INFO
      // =====================================

      if (data === "menu_info") {

        return bot.sendMessage(
          q.message.chat.id,
`ℹ️ INFORMAÇÕES

🚀 Sistema:
MAX FULL

⚡ Status:
ONLINE

👤 Desenvolvedor:
Faelzin

📲 Suporte:
${WHATSAPP}`
        );
      }

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

👤 WhatsApp:
${p.whatsapp}`,
{
  reply_markup: {
    inline_keyboard: [[{
      text: "🛒 COMPRAR AGORA",
      callback_data:
      `buy_${doc.id}`
    }]]
  }
}
          );
        }
      }

      // =====================================
      // ADMIN ADD
      // =====================================

      if (data === "admin_add") {

        if (
          userId !== MASTER &&
          !ADMINS.includes(userId)
        ) return;

        userState[userId] = {
          step: "produto"
        };

        return bot.sendMessage(
          q.message.chat.id,
          "📦 Nome do produto:"
        );
      }

      // =====================================
      // ADMIN LISTAR
      // =====================================

      if (data === "admin_listar") {

        if (
          userId !== MASTER &&
          !ADMINS.includes(userId)
        ) return;

        const snap = await db
          .collection('produtos')
          .get();

        if (snap.empty) {

          return bot.sendMessage(
            q.message.chat.id,
            "❌ Nenhum produto"
          );
        }

        let texto =
"📦 PRODUTOS\n\n";

        snap.forEach(doc => {

          const p = doc.data();

          texto +=
`🆔 ${doc.id}

📦 ${p.nome}
💰 ${p.preco}

`;
        });

        return bot.sendMessage(
          q.message.chat.id,
          texto
        );
      }

      // =====================================
      // ADMIN LIMPAR
      // =====================================

      if (data === "admin_limpar") {

        if (userId !== MASTER)
          return;

        const snap = await db
          .collection('produtos')
          .get();

        for (const doc of snap.docs) {

          await db
            .collection('produtos')
            .doc(doc.id)
            .delete();
        }

        return bot.sendMessage(
          q.message.chat.id,
          "🗑 Todos produtos deletados"
        );
      }

      // =====================================
      // COMPRAR
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

        // =================================
        // MERCADO PAGO PIX
        // =================================

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
              `cliente${Date.now()}@gmail.com`
            }
          }
        });

        console.log(payment);

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

            link:
            p.link,

            aprovado:
            false,

            createdAt:
            Date.now()
          });

        // =================================
        // ENVIA PIX
        // =================================

        await bot.sendPhoto(
          q.message.chat.id,
          Buffer.from(
            qr,
            'base64'
          ),
{
  caption:
`💰 PAGAMENTO PIX

━━━━━━━━━━━━━━━━━━━

📦 ${p.nome}

💲 R$ ${p.preco}

📋 PIX COPIA E COLA:

${copia}

━━━━━━━━━━━━━━━━━━━

⏳ Aguardando pagamento...

⚠️ Aprovação automática.`
}
        );
      }

    } catch (err) {

      console.log("❌ CALLBACK ERROR:", err);
    }
  }
);

// =========================================
// ADD PRODUTO
// =========================================

bot.on(
  "message",
  async (msg) => {

    try {

      if (!msg.text)
        return;

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

        state.step = "whatsapp";

        return bot.sendMessage(
          msg.chat.id,
          "📲 WhatsApp:"
        );
      }

      // =====================================
      // WHATSAPP
      // =====================================

      if (state.step === "whatsapp") {

        state.whatsapp = text;

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

            whatsapp:
            state.whatsapp,

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
