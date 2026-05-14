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

const WHATSAPP =
"551981528372";

const BOT_USERNAME =
"SellForge_bot";

const LOGO =
"https://i.postimg.cc/g2JJvqHN/logo.jpg";

const AUDIO =
"https://files.catbox.moe/p6wlxb.mp3";

const userState = {};

// =========================================
// PLANOS
// =========================================

const PLANOS = {

  test: {
    nome: "TESTE 1 MIN",
    valor: 0.01,
    minutos: 1
  },

  d3: {
    nome: "3 DIAS",
    valor: 0.97,
    dias: 3
  },

  d7: {
    nome: "7 DIAS",
    valor: 1.99,
    dias: 7
  },

  d14: {
    nome: "14 DIAS",
    valor: 2.60,
    dias: 14
  },

  d21: {
    nome: "21 DIAS",
    valor: 3.90,
    dias: 21
  },

  d30: {
    nome: "30 DIAS",
    valor: 5.00,
    dias: 30
  }
};

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

const mpClient =
new MercadoPagoConfig({
  accessToken:
  process.env.MP_ACCESS_TOKEN
});

const mpPayment =
new Payment(mpClient);

// =========================================
// FIREBASE
// =========================================

const serviceAccount =
JSON.parse(
  process.env.FIREBASE_CONFIG
);

initializeApp({
  credential:
  cert(serviceAccount)
});

const db =
getFirestore();

console.log(
"🔥 Firebase conectado"
);

// =========================================
// TELEGRAM
// =========================================

const bot =
new TelegramBot(
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

    await bot.processUpdate(
      req.body
    );

    res.sendStatus(200);

  } catch (err) {

    console.log(err);

    res.sendStatus(500);
  }
});

// =========================================
// HOME
// =========================================

app.get('/', (req, res) => {

  res.send(
    "🚀 BOT ONLINE"
  );
});

// =========================================
// VERIFICAR PLANO
// =========================================

async function possuiPlano(userId){

  const doc =
  await db
  .collection("vendedores")
  .doc(userId)
  .get();

  if (!doc.exists)
    return false;

  const data =
  doc.data();

  if (!data.expiraEm)
    return false;

  return Date.now() <
  data.expiraEm;
}

// =========================================
// WEBHOOK MP
// =========================================

app.post(
'/webhook/mp',
async (req, res) => {

  try {

    const data =
    req.body;

    if (
      data.type !== "payment"
    ) {
      return res.sendStatus(200);
    }

    const payment =
    await mpPayment.get({
      id:
      data.data.id
    });

    if (
      payment.status !==
      "approved"
    ) {
      return res.sendStatus(200);
    }

    const vendaRef =
    db.collection(
      'pagamentos'
    )
    .doc(
      String(payment.id)
    );

    const venda =
    await vendaRef.get();

    if (!venda.exists)
      return res.sendStatus(200);

    const info =
    venda.data();

    if (info.aprovado)
      return res.sendStatus(200);

    await vendaRef.update({

      aprovado: true,

      status:
      "approved"
    });

    // =====================================
    // PLANO
    // =====================================

    if (
      info.tipo === "plano"
    ) {

      const plano =
      PLANOS[info.plano];

      let expiraEm =
      Date.now();

      if (plano.minutos) {

        expiraEm +=
        plano.minutos *
        60 *
        1000;
      }

      if (plano.dias) {

        expiraEm +=
        plano.dias *
        24 *
        60 *
        60 *
        1000;
      }

      await db
      .collection("vendedores")
      .doc(info.userId)
      .set({

        nome:
        info.nome,

        loja:
        info.loja,

        expiraEm

      }, {
        merge: true
      });

      const linkLoja =
`https://t.me/${BOT_USERNAME}?start=loja_${info.loja}`;

      await bot.sendMessage(
        info.chatId,

`✅ PLANO ATIVADO

━━━━━━━━━━━━━━━━━━━

👤 Loja:
${info.loja}

📅 Plano:
${plano.nome}

🔗 LINK LOJA:

${linkLoja}

━━━━━━━━━━━━━━━━━━━

✅ Você já pode vender`
      );

      return res.sendStatus(200);
    }

    // =====================================
    // ENTREGA PRODUTO
    // =====================================

    await bot.sendMessage(
      info.chatId,

`✅ PAGAMENTO APROVADO

━━━━━━━━━━━━━━━━━━━

📦 Produto:
${info.produto}

💰 Valor:
R$ ${info.valor}

📲 WhatsApp:
${info.whatsapp}

━━━━━━━━━━━━━━━━━━━

🔓 LINK:

${info.link}

━━━━━━━━━━━━━━━━━━━

🚀 Obrigado pela compra`
    );

    res.sendStatus(200);

  } catch (err) {

    console.log(
      "❌ WEBHOOK:",
      err
    );

    res.sendStatus(500);
  }
});

// =========================================
// START
// =========================================

bot.onText(
/\/start(?: (.+))?/,
async (msg, match) => {

  try {

    const chatId =
    msg.chat.id;

    const userId =
    String(msg.from.id);

    const param =
    match[1];

    // =====================================
    // LOJA
    // =====================================

    if (
      param &&
      param.startsWith(
        "loja_"
      )
    ) {

      const loja =
      param.replace(
        "loja_",
        ""
      );

      const snap =
      await db
      .collection("produtos")
      .where(
        "loja",
        "==",
        loja
      )
      .get();

      if (snap.empty) {

        return bot.sendMessage(
          chatId,
          "❌ Loja vazia"
        );
      }

      const buttons = [];

      snap.forEach(doc => {

        const p =
        doc.data();

        buttons.push([{

          text:
`${p.nome} - R$ ${p.preco}`,

          callback_data:
`view_${doc.id}`
        }]);
      });

      return bot.sendMessage(
        chatId,

`🛒 LOJA ${loja}`,

{
  reply_markup: {
    inline_keyboard:
    buttons
  }
}
      );
    }

    // =====================================
    // AUDIO
    // =====================================

    await bot.sendAudio(
      chatId,
      AUDIO,
{
  caption:
"🎧 Bem-vindo(a)"
}
    );

    // =====================================
    // FOTO
    // =====================================

    await bot.sendPhoto(
      chatId,
      LOGO,
{
  caption:

`🚀 Bem-vindo(a)

━━━━━━━━━━━━━━━━━━━

✅ Loja automática
✅ PIX automático
✅ Entrega automática
✅ Produtos ilimitados

━━━━━━━━━━━━━━━━━━━

👇 Escolha abaixo`
}
    );

    const ativo =
    await possuiPlano(
      userId
    );

    // =====================================
    // SEM PLANO
    // =====================================

    if (!ativo) {

      return bot.sendMessage(
        chatId,

`💎 ALUGAR BOT

━━━━━━━━━━━━━━━━━━━

🧪 TESTE 1 MIN
R$ 0,01

📅 3 DIAS
R$ 0,97

📅 7 DIAS
R$ 1,99

📅 14 DIAS
R$ 2,60

📅 21 DIAS
R$ 3,90

📅 30 DIAS
R$ 5,00

━━━━━━━━━━━━━━━━━━━`

,
{
  reply_markup: {
    inline_keyboard: [

      [
        {
          text:
          "🧪 TESTE",

          callback_data:
          "plano_test"
        }
      ],

      [
        {
          text:
          "3 DIAS",

          callback_data:
          "plano_d3"
        },

        {
          text:
          "7 DIAS",

          callback_data:
          "plano_d7"
        }
      ],

      [
        {
          text:
          "14 DIAS",

          callback_data:
          "plano_d14"
        },

        {
          text:
          "21 DIAS",

          callback_data:
          "plano_d21"
        }
      ],

      [
        {
          text:
          "30 DIAS",

          callback_data:
          "plano_d30"
        }
      ]
    ]
  }
}
      );
    }

    // =====================================
    // MENU
    // =====================================

    const vendedorDoc =
    await db
    .collection("vendedores")
    .doc(userId)
    .get();

    const vendedor =
    vendedorDoc.data();

    const lojaLink =
`https://t.me/${BOT_USERNAME}?start=loja_${vendedor.loja}`;

    await bot.sendMessage(
      chatId,

`🚀 PAINEL VENDEDOR

━━━━━━━━━━━━━━━━━━━

👤 Loja:
${vendedor.loja}

🔗 LINK:
${lojaLink}

━━━━━━━━━━━━━━━━━━━`

,
{
  reply_markup: {
    inline_keyboard: [

      [
        {
          text:
          "➕ ADD PRODUTO",

          callback_data:
          "add_produto"
        }
      ],

      [
        {
          text:
          "📦 MINHA LOJA",

          callback_data:
          "minha_loja"
        }
      ],

      [
        {
          text:
          "🗑 ZERAR LOJA",

          callback_data:
          "zerar_loja"
        }
      ],

      [
        {
          text:
          "🔄 RENOVAR",

          callback_data:
          "renovar"
        },

        {
          text:
          "❌ CANCELAR",

          callback_data:
          "cancelar"
