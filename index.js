require('dotenv').config();

process.on(
'unhandledRejection',
(err) => {
  console.log(
    'UNHANDLED:',
    err
  );
}
);

process.on(
'uncaughtException',
(err) => {
  console.log(
    'UNCAUGHT:',
    err
  );
}
);

const express = require('express');

const TelegramBot =
require('node-telegram-bot-api');

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
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));

// =========================================
// CONFIG
// =========================================

const MASTER =
"6863505946";

const ADMINS = [
  "8510878195"
];

const WHATSAPP =
"551981528372";

const SUPPORT =
"@suporte_inifnity_clientes_oficial";

const BOT_USERNAME =
"SellForge_bot";

const LOGO =
"https://i.postimg.cc/g2JJvqHN/logo.jpg";

// =========================================
// SISTEMAS
// =========================================

const userState = {};

const spamControl = {};

const blockedUsers = {};

const bannedAdmins = {};

const adminLimits = {};

const adminExpire = {

  "8510878195":
  Date.now() +
  (
    30 * 24 * 60 * 60 * 1000
  )
};

// =========================================
// VALIDAÇÕES
// =========================================

if (!process.env.BOT_TOKEN)
  throw new Error(
    "BOT_TOKEN ausente"
  );

if (!process.env.MP_ACCESS_TOKEN)
  throw new Error(
    "MP_ACCESS_TOKEN ausente"
  );

if (!process.env.RENDER_EXTERNAL_URL)
  throw new Error(
    "RENDER_EXTERNAL_URL ausente"
  );

if (!process.env.FIREBASE_CONFIG)
  throw new Error(
    "FIREBASE_CONFIG ausente"
  );

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

    console.log(
      "WEBHOOK BOT ERROR:",
      err
    );

    res.sendStatus(500);
  }
});

// =========================================
// HOME
// =========================================

app.get('/',
(req, res) => {

  res.send(
    "🚀 BOT ONLINE"
  );
});

// =========================================
// LOG ADMIN
// =========================================

async function adminLog(texto) {

  try {

    await bot.sendMessage(
      MASTER,
      texto
    );

    await db
    .collection('admin_logs')
    .add({

      texto,

      createdAt:
      Date.now()
    });

  } catch (err) {

    console.log(
      "ADMIN LOG ERROR:",
      err
    );
  }
}

// =========================================
// SPAM
// =========================================

function isBlocked(userId) {

  if (
    !blockedUsers[userId]
  ) return false;

  return Date.now() <
  blockedUsers[userId];
}

function addSpam(userId) {

  if (
    !spamControl[userId]
  ) {

    spamControl[userId] = {

      count: 0
    };
  }

  spamControl[userId]
  .count++;

  if (
    spamControl[userId]
    .count >= 5
  ) {

    blockedUsers[userId] =
    Date.now() + 60000;

    spamControl[userId]
    .count = 0;

    return true;
  }

  return false;
}

// =========================================
// ADMIN
// =========================================

function isAdminBanned(
  userId
) {

  if (
    !bannedAdmins[userId]
  ) return false;

  return Date.now() <
  bannedAdmins[userId];
}

function isAdminExpired(
  userId
) {

  if (
    !adminExpire[userId]
  ) return false;

  return Date.now() >
  adminExpire[userId];
}

function adminCanAction(
  userId,
  action
) {

  if (
    userId === MASTER
  ) return true;

  if (
    !adminLimits[userId]
  ) {

    adminLimits[userId] = {

      add: 0,

      delete: 0,

      date:
      new Date()
      .toDateString()
    };
  }

  const today =
  new Date()
  .toDateString();

  if (
    adminLimits[userId]
    .date !== today
  ) {

    adminLimits[userId] = {

      add: 0,

      delete: 0,

      date: today
    };
  }

  if (
    action === "add" &&
    adminLimits[userId]
    .add >= 2
  ) {

    return false;
  }

  if (
    action === "delete" &&
    adminLimits[userId]
    .delete >= 2
  ) {

    return false;
  }

  return true;
}

// =========================================
// TECLADO FLUTUANTE
// =========================================

async function sendKeyboard(
  chatId
) {

  return bot.sendMessage(
    chatId,

`⬛ MENU RÁPIDO`,

{
  reply_markup: {

    keyboard: [

      [
        "📦 Produtos",
        "🛒 Compras"
      ],

      [
        "📡 Status",
        "📲 Suporte"
      ]
    ],

    resize_keyboard: true,

    persistent: true
  }
}
  );
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
      data.type !==
      "payment"
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

    if (
      info.aprovado
    ) {

      return res.sendStatus(200);
    }

    await vendaRef.update({

      aprovado: true,

      status:
      "approved"
    });

    // =====================================
    // ESTOQUE
    // =====================================

    const produtoRef =
    db.collection('produtos')
    .doc(info.produtoId);

    const produtoDoc =
    await produtoRef.get();

    if (
      produtoDoc.exists
    ) {

      const produto =
      produtoDoc.data();

      let estoque =
      produto.estoque || 0;

      estoque--;

      if (
        estoque <= 0
      ) {

        await produtoRef.delete();

        await adminLog(

`📦 PRODUTO REMOVIDO

Motivo:
Estoque zerado

📦 ${produto.nome}`
        );

      } else {

        await produtoRef.update({

          estoque
        });
      }

      await produtoRef.update({

        vendas:
        (
          produto.vendas || 0
        ) + 1
      });
    }

    // =====================================
    // ENTREGA
    // =====================================

    await bot.sendMessage(
      info.chatId,

`✅ PAGAMENTO APROVADO

━━━━━━━━━━━━━━━━━━━

📦 Produto:
${info.produto}

💰 Valor:
R$ ${info.valor}

🔓 LINK LIBERADO:

${info.link}

━━━━━━━━━━━━━━━━━━━

🚀 Obrigado pela compra!`
    );

    await adminLog(

`💰 PAGAMENTO APROVADO

📦 ${info.produto}

💵 ${info.valor}`
    );

    res.sendStatus(200);

  } catch (err) {

    console.log(
      "WEBHOOK MP ERROR:",
      err
    );

    res.sendStatus(500);
  }
});

// =========================================
// START
// =========================================

bot.onText(
/\/start/,
async (msg) => {

  try {

    const chatId =
    msg.chat.id;

    const userId =
    String(msg.from.id);

    // =====================================
    // FOTO
    // =====================================

    await bot.sendPhoto(
      chatId,
      LOGO,
{
  caption:

`🚀 SELLFORGE MARKETPLACE

⚡ Plataforma automática premium
💳 PIX automático
📦 Entrega instantânea
🛡️ Segurança total

👑 Desenvolvido por Faelzin`
}
    );

    // =====================================
    // TEXTO GRANDE
    // =====================================

    await bot.sendMessage(
      chatId,

`🚀 BEM-VINDO AO SELLFORGE MARKETPLACE ⚡

━━━━━━━━━━━━━━━━━━━
👑 PLATAFORMA PREMIUM
━━━━━━━━━━━━━━━━━━━

Olá 👋 Seja muito bem-vindo(a) ao SellForge ⚡

Aqui você encontra uma experiência profissional, automática e totalmente segura para compras digitais diretamente pelo Telegram.

━━━━━━━━━━━━━━━━━━━
⚡ RECURSOS DISPONÍVEIS
━━━━━━━━━━━━━━━━━━━

✅ Produtos digitais premium
✅ Aprovação automática
✅ Entrega instantânea
✅ PIX automático Mercado Pago
✅ Sistema inteligente de estoque
✅ Painel ADMIN secreto
✅ Segurança anti-flood
✅ Dashboard profissional
✅ Histórico de compras
✅ Sistema automático de vendas
✅ Atendimento rápido
✅ Plataforma 24 horas online

━━━━━━━━━━━━━━━━━━━
🛡️ SEGURANÇA & GARANTIA
━━━━━━━━━━━━━━━━━━━

⚠️ Não compre fora do bot oficial.

🔒 Sistema protegido
🔒 Pagamentos verificados
🔒 Entrega automática instantânea

━━━━━━━━━━━━━━━━━━━
📈 STATUS SISTEMA
━━━━━━━━━━━━━━━━━━━

🟢 BOT ONLINE
🟢 FIREBASE ONLINE
🟢 MERCADO PAGO ONLINE
🟢 WEBHOOK ONLINE
🟢 ESTOQUE ATIVO

━━━━━━━━━━━━━━━━━━━
📲 SUPORTE
━━━━━━━━━━━━━━━━━━━

${SUPPORT}

👇 Escolha uma opção abaixo.`,

{
  reply_markup: {
    inline_keyboard: [

      [
        {
          text:
          "📦 PRODUTOS",

          callback_data:
          "menu_produtos"
        }
      ],

      [
        {
          text:
          "📡 STATUS",

          callback_data:
          "menu_status"
        }
      ],

      [
        {
          text:
          "📲 SUPORTE",

          url:
`https://wa.me/${WHATSAPP}`
        }
      ]
    ]
  }
}
    );

    // =====================================
    // TECLADO
    // =====================================

    await sendKeyboard(
      chatId
    );

    // =====================================
    // ADMIN
    // =====================================

    if (
      userId === MASTER ||
      ADMINS.includes(userId)
    ) {

      await bot.sendMessage(
        chatId,

`👑 PAINEL ADMIN

Use:
/staff_dono`
      );
    }

  } catch (err) {

    console.log(
      "START ERROR:",
      err
    );
  }
});

// =========================================
// STAFF
// =========================================

bot.onText(
/\/staff_dono/,
async (msg) => {

  try {

    const userId =
    String(msg.from.id);

    if (
      userId !== MASTER &&
      !ADMINS.includes(userId)
    ) return;

    if (
      isAdminBanned(userId)
    ) {

      return bot.sendMessage(
        msg.chat.id,

`⛔ Identificamos tentativas não autorizadas dentro painel ADMIN.`
      );
    }

    if (
      isAdminExpired(userId)
    ) {

      return bot.sendMessage(
        msg.chat.id,

`⛔ Cargo ADMIN expirado`
      );
    }

    await bot.sendMessage(
      msg.chat.id,

`👑 PAINEL ADMIN`,

{
  reply_markup: {
    inline_keyboard: [

      [
        {
          text:
          "➕ ADD PRODUTO",

          callback_data:
          "admin_add"
        }
      ],

      [
        {
          text:
          "📦 LISTAR",

          callback_data:
          "admin_listar"
        }
      ],

      [
        {
          text:
          "🔥 LIMPAR",

          callback_data:
          "admin_limpar"
        }
      ]
    ]
  }
}
    );

  } catch (err) {

    console.log(
      "STAFF ERROR:",
      err
    );
  }
});

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

  try {

    const webhook =
`${process.env.RENDER_EXTERNAL_URL}${SECRET_PATH}`;

    await bot.setWebHook(
      webhook
    );

    console.log(
      "✅ WEBHOOK SETADO"
    );

    console.log(
      webhook
    );

  } catch (err) {

    console.log(
      "WEBHOOK ERROR:",
      err
    );
  }
}
);
