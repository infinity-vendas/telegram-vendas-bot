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

// ======================================
// EXPRESS
// ======================================

const app = express();

app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));

// ======================================
// CONFIG
// ======================================

const MASTER = "6863505946";

const ADMINS = [
  "8510878195"
];

const WHATSAPP = "551981528372";

const BOT_USERNAME = "SellForge_bot";

let BOT_ATIVO = true;

// ======================================
// VALIDAÇÕES
// ======================================

if (!process.env.BOT_TOKEN) {
  console.log("❌ BOT_TOKEN ausente");
  process.exit(1);
}

if (!process.env.MP_ACCESS_TOKEN) {
  console.log("❌ MP_ACCESS_TOKEN ausente");
  process.exit(1);
}

if (!process.env.RENDER_EXTERNAL_URL) {
  console.log("❌ RENDER_EXTERNAL_URL ausente");
  process.exit(1);
}

if (!process.env.FIREBASE_CONFIG) {
  console.log("❌ FIREBASE_CONFIG ausente");
  process.exit(1);
}

// ======================================
// MERCADO PAGO
// ======================================

const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN
});

const mpPayment = new Payment(mpClient);

// ======================================
// FIREBASE
// ======================================

let db;

try {

  const serviceAccount = JSON.parse(
    process.env.FIREBASE_CONFIG
  );

  initializeApp({
    credential: cert(serviceAccount)
  });

  db = getFirestore();

  console.log("🔥 Firebase conectado");

} catch (err) {

  console.log("❌ FIREBASE ERROR");
  console.log(err);

  process.exit(1);
}

// ======================================
// TELEGRAM
// ======================================

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

      console.log("❌ UPDATE ERROR");
      console.log(err);

      res.sendStatus(500);
    }
  }
);

// ======================================
// HOME
// ======================================

app.get('/', (req, res) => {
  res.send("🚀 BOT ONLINE");
});

// ======================================
// STATUS
// ======================================

const userState = {};

const LOGO =
"https://i.postimg.cc/g2JJvqHN/logo.jpg";

// ======================================
// WEBHOOK MP
// ======================================

app.post('/webhook/mp', async (req, res) => {

  try {

    console.log("📩 WEBHOOK MP:");
    console.log(JSON.stringify(req.body, null, 2));

    const data = req.body;

    if (data.type !== "payment") {
      return res.sendStatus(200);
    }

    const payment = await mpPayment.get({
      id: data.data.id
    });

    console.log("💰 PAYMENT:");
    console.log(payment);

    if (payment.status !== "approved") {
      return res.sendStatus(200);
    }

    const vendaRef = db
      .collection('pagamentos')
      .doc(String(payment.id));

    const venda = await vendaRef.get();

    if (!venda.exists) {
      console.log("❌ VENDA NÃO ENCONTRADA");
      return res.sendStatus(200);
    }

    const info = venda.data();

    if (info.aprovado) {
      return res.sendStatus(200);
    }

    await vendaRef.update({
      aprovado: true,
      status: "approved",
      aprovadoEm: Date.now()
    });

    await bot.sendMessage(
      info.chatId,
`✅ PAGAMENTO APROVADO!

📦 Produto:
${info.produto}

💰 Valor:
R$ ${info.valor}

📲 Finalize:
https://wa.me/${info.whatsapp}`
    );

    res.sendStatus(200);

  } catch (err) {

    console.log("❌ WEBHOOK ERROR");
    console.log(err);

    res.sendStatus(500);
  }
});

// ======================================
// START
// ======================================

bot.onText(/\/start/, async (msg) => {

  try {

    if (!BOT_ATIVO) return;

    const chatId = msg.chat.id;

    const id = String(msg.from.id);

    await bot.sendPhoto(
      chatId,
      LOGO
    );

    await bot.sendMessage(
      chatId,
`Olá 👋

Sou seu assistente virtual 🤖

🔥 Confira nossos produtos e planos.

Escolha abaixo 👇`,
{
  reply_markup: {
    keyboard: [
      ["📦 Produtos", "📊 Planos"],
      ["🤖 Alugar Bot", "📲 Suporte"],
      ["🔗 Meu Link"]
    ],
    resize_keyboard: true
  }
});

    if (
      id === MASTER ||
      ADMINS.includes(id)
    ) {

      await bot.sendMessage(
        chatId,
`🔐 ADMIN LIBERADO

/comandos_admin`
      );
    }

  } catch (err) {

    console.log("❌ START ERROR");
    console.log(err);
  }
});

// ======================================
// ADMIN
// ======================================

bot.onText(/\/comandos_admin/, async (msg) => {

  const id = String(msg.from.id);

  if (
    id !== MASTER &&
    !ADMINS.includes(id)
  ) return;

  await bot.sendMessage(
    msg.chat.id,
`🔐 PAINEL ADMIN

/add_produto
/del_produto ID
/listar_produtos

👑 MASTER:
/desligar_bot
/ligar_bot`
  );
});

// ======================================
// ADD PRODUTO
// ======================================

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

// ======================================
// DELETE PRODUTO
// ======================================

bot.onText(
  /\/del_produto (.+)/,
  async (msg, match) => {

    try {

      const id = String(msg.from.id);

      if (
        id !== MASTER &&
        !ADMINS.includes(id)
      ) return;

      const produtoId = match[1];

      await db
        .collection('produtos')
        .doc(produtoId)
        .delete();

      bot.sendMessage(
        msg.chat.id,
        "🗑 Produto deletado"
      );

    } catch (err) {

      console.log(err);
    }
  }
);

// ======================================
// LISTAR PRODUTOS
// ======================================

bot.onText(
  /\/listar_produtos/,
  async (msg) => {

    try {

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

      let texto = "📦 PRODUTOS:\n\n";

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

    } catch (err) {

      console.log(err);
    }
  }
);

// ======================================
// BOT ON/OFF
// ======================================

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

// ======================================
// MESSAGE
// ======================================

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

      console.log(
        `[MSG] ${id}: ${text}`
      );

      if (text.startsWith("/")) {
        return;
      }

      if (
        !BOT_ATIVO &&
        id !== MASTER
      ) {

        return bot.sendMessage(
          msg.chat.id,
          "🚫 Bot desligado"
        );
      }

      // ======================================
      // ADD PRODUTO
      // ======================================

      if (state?.step === "nome") {

        state.nome = text;

        state.step = "preco";

        return bot.sendMessage(
          msg.chat.id,
          "💰 Valor:"
        );
      }

      if (state?.step === "preco") {

        const valor = Number(
          text
            .replace("R$", "")
            .replace(",", ".")
            .trim()
        );

        if (isNaN(valor)) {

          return bot.sendMessage(
            msg.chat.id,
            "❌ Valor inválido"
          );
        }

        state.preco = valor;

        state.step = "desc";

        return bot.sendMessage(
          msg.chat.id,
          "📝 Descrição:"
        );
      }

      if (state?.step === "desc") {

        state.desc = text;

        state.step = "img";

        return bot.sendMessage(
          msg.chat.id,
          "🖼️ Link da imagem:"
        );
      }

      if (state?.step === "img") {

        state.img = text;

        state.step = "zap";

        return bot.sendMessage(
          msg.chat.id,
          "📲 WhatsApp:"
        );
      }

      if (state?.step === "zap") {

        await db
          .collection('produtos')
          .add({
            nome: state.nome,
            preco: state.preco,
            desc: state.desc,
            img: state.img,
            whatsapp: text,
            criadoPor: id,
            createdAt: Date.now()
          });

        userState[id] = null;

        return bot.sendMessage(
          msg.chat.id,
          "✅ Produto adicionado"
        );
      }

      // ======================================
      // PRODUTOS
      // ======================================

      if (text === "📦 Produtos") {

        const snap = await db
          .collection('produtos')
          .get();

        if (snap.empty) {

          return bot.sendMessage(
            msg.chat.id,
            "❌ Nenhum produto"
          );
        }

        for (const doc of snap.docs) {

          const p = doc.data();

          await bot.sendPhoto(
            msg.chat.id,
            p.img,
            {
              caption:
`📦 ${p.nome}

💰 R$ ${p.preco}

📝 ${p.desc}`,
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

      // ======================================
      // PLANOS
      // ======================================

      if (text === "📊 Planos") {

        return bot.sendMessage(
          msg.chat.id,
`📊 PLANOS DISPONÍVEIS

1D = R$5
3D = R$15
10D = R$30
20D = R$60
30D = R$90`
        );
      }

      // ======================================
      // ALUGAR BOT
      // ======================================

      if (text === "🤖 Alugar Bot") {

        return bot.sendMessage(
          msg.chat.id,
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

      // ======================================
      // SUPORTE
      // ======================================

      if (text === "📲 Suporte") {

        return bot.sendMessage(
          msg.chat.id,
          "📲 Fale conosco:",
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

      // ======================================
      // LINK
      // ======================================

      if (text === "🔗 Meu Link") {

        return bot.sendMessage(
          msg.chat.id,
`🔗 Seu link:

https://t.me/${BOT_USERNAME}`
        );
      }

    } catch (err) {

      console.log("❌ MESSAGE ERROR");
      console.log(err);
    }
  }
);

// ======================================
// CALLBACK PIX
// ======================================

bot.on(
  "callback_query",
  async (q) => {

    try {

      await bot.answerCallbackQuery(
        q.id
      );

      const idProduto =
        q.data.replace(
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

      const valor =
        Number(p.preco);

      const payment =
        await mpPayment.create({
          body: {

            transaction_amount:
              valor,

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
            valor,

          whatsapp:
            p.whatsapp,

          status:
            "pending",

          aprovado:
            false,

          createdAt:
            Date.now()
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

💲 R$ ${valor}

📋 PIX COPIA E COLA:

${copia}

⏳ Aguardando pagamento...`
}
      );

    } catch (err) {

      console.log("❌ PIX ERROR");
      console.log(err);

      bot.sendMessage(
        q.message.chat.id,
        "❌ Erro ao gerar PIX"
      );
    }
  }
);

// ======================================
// ERROR GLOBAL
// ======================================

process.on(
  'unhandledRejection',
  (err) => {

    console.log(
      "❌ UNHANDLED"
    );

    console.log(err);
  }
);

process.on(
  'uncaughtException',
  (err) => {

    console.log(
      "❌ UNCAUGHT"
    );

    console.log(err);
  }
);

// ======================================
// SERVER
// ======================================

const PORT =
  process.env.PORT || 3000;

app.listen(
  PORT,
  async () => {

    console.log(
      `🚀 ONLINE ${PORT}`
    );

    try {

      const webhook =
`${process.env.RENDER_EXTERNAL_URL}${SECRET_PATH}`;

      await bot.setWebHook(
        webhook
      );

      console.log(
        "✅ WEBHOOK SETADO:"
      );

      console.log(webhook);

    } catch (err) {

      console.log(
        "❌ WEBHOOK ERROR"
      );

      console.log(err);
    }
  }
);
