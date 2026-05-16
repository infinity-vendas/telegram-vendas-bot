// =========================================
// SELLFORGE BOT FULL ANTIGO + NOVO
// =========================================

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

const MASTER =
"6863505946";

const ADMINS = [
  "8510878195"
];

const WHATSAPP =
"551981528372";

const BOT_USERNAME =
"SellForge_bot";

const LOGO =
"https://i.postimg.cc/g2JJvqHN/logo.jpg";

// =========================================
// SISTEMA
// =========================================

const userState = {};

const userCooldown = {};

const userDaily = {};

const pixPending = {};

// =========================================
// LIMITES
// =========================================

const COMMAND_LIMIT = 80;

const PIX_LIMIT = 7;

const PRODUCT_LIMIT = 30;

// =========================================
// FUNÇÕES
// =========================================

function getToday() {

  const d = new Date();

  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function initUser(userId) {

  const today = getToday();

  if (!userDaily[userId]) {

    userDaily[userId] = {

      date: today,

      commands: 0,

      pix: 0,

      produtos: 0
    };
  }

  if (
    userDaily[userId].date !== today
  ) {

    userDaily[userId] = {

      date: today,

      commands: 0,

      pix: 0,

      produtos: 0
    };
  }
}

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
// REGISTRAR USUÁRIO
// =========================================

async function registrarUsuario(user) {

  try {

    const hoje =
    getToday();

    const ref =
    db.collection('usuarios')
    .doc(String(user.id));

    const doc =
    await ref.get();

    if (!doc.exists) {

      await ref.set({

        id:
        String(user.id),

        nome:
        user.first_name || "Sem nome",

        username:
        user.username || null,

        primeiroAcesso:
        Date.now(),

        ultimoAcesso:
        Date.now(),

        ultimoDia:
        hoje
      });

      return;
    }

    await ref.update({

      ultimoAcesso:
      Date.now(),

      ultimoDia:
      hoje
    });

  } catch (err) {

    console.log(err);
  }
}

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
// ADMIN
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
    ) {
      return;
    }

    await bot.sendMessage(
      msg.chat.id,

`🔐 PAINEL ADMIN

━━━━━━━━━━━━━━━━━━━

✅ Sistema online
✅ Controle total

━━━━━━━━━━━━━━━━━━━`,

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
          "📦 LISTAR PRODUTOS",

          callback_data:
          "admin_listar"
        }
      ],

      [
        {
          text:
          "❌ DELETAR POR ID",

          callback_data:
          "admin_delete_id"
        }
      ],

      [
        {
          text:
          "🗑 LIMPAR PRODUTOS",

          callback_data:
          "admin_limpar"
        }
      ]
    ]
  }
}
    );

  } catch (err) {

    console.log(err);
  }
});

// =========================================
// STATS SECRETO
// =========================================

bot.onText(
/\/stats/,
async (msg) => {

  try {

    const userId =
    String(msg.from.id);

    if (
      userId !== MASTER &&
      !ADMINS.includes(userId)
    ) {
      return;
    }

    const usuariosSnap =
    await db
    .collection('usuarios')
    .get();

    const produtosSnap =
    await db
    .collection('produtos')
    .get();

    const pagamentosSnap =
    await db
    .collection('pagamentos')
    .get();

    const hoje =
    getToday();

    let usuariosHoje = 0;

    usuariosSnap.forEach(doc => {

      const u =
      doc.data();

      if (
        u.ultimoDia === hoje
      ) {

        usuariosHoje++;
      }
    });

    let aprovados = 0;

    pagamentosSnap.forEach(doc => {

      const p =
      doc.data();

      if (p.aprovado)
        aprovados++;
    });

    return bot.sendMessage(
      msg.chat.id,

`📊 ESTATÍSTICAS SECRETAS

━━━━━━━━━━━━━━━━━━━

👥 Usuários:
${usuariosSnap.size}

📅 Hoje:
${usuariosHoje}

📦 Produtos:
${produtosSnap.size}

💰 Pagamentos:
${pagamentosSnap.size}

✅ Aprovados:
${aprovados}

━━━━━━━━━━━━━━━━━━━

⚙️ LIMITES

⚡ Comandos:
${COMMAND_LIMIT}

📦 Produtos:
${PRODUCT_LIMIT}

💰 PIX:
${PIX_LIMIT}`
    );

  } catch (err) {

    console.log(err);
  }
});

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

    const produtoRef =
    db.collection('produtos')
    .doc(info.produtoId);

    const produtoDoc =
    await produtoRef.get();

    let estoqueRestante = 0;

    if (produtoDoc.exists) {

      const estoqueAtual =
      produtoDoc.data().estoque || 0;

      estoqueRestante =
      estoqueAtual - 1;

      if (estoqueRestante < 0)
        estoqueRestante = 0;

      await produtoRef.update({

        estoque:
        estoqueRestante
      });
    }

    delete pixPending[
      String(info.userId)
    ];

    await bot.sendMessage(
      info.chatId,

`✅ PAGAMENTO APROVADO!

━━━━━━━━━━━━━━━━━━━

📦 Produto:
${info.produto}

💰 Valor:
R$ ${info.valor}

📦 Estoque:
${estoqueRestante}

━━━━━━━━━━━━━━━━━━━

🔓 LINK:

${info.link}

━━━━━━━━━━━━━━━━━━━

🚀 Obrigado pela compra!`
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

bot.onText(
/\/start/,
async (msg) => {

  try {

    await registrarUsuario(
      msg.from
    );

    const chatId =
    msg.chat.id;

    await bot.sendPhoto(
      chatId,
      LOGO,
{
  caption:

`🚀 Bem-vindo(a)!

INFINITY CLIENTES

━━━━━━━━━━━━━━━━━━━

✅ PIX automático
✅ Entrega automática
✅ Sistema protegido

━━━━━━━━━━━━━━━━━━━

👇 Escolha abaixo`
}
    );

    await bot.sendMessage(
      chatId,

`📋 MENU PRINCIPAL`,

{
  reply_markup: {

    keyboard: [

      [
        "📦 PRODUTOS"
      ],

      [
        "ℹ️ INFORMAÇÕES",
        "📲 SUPORTE"
      ]
    ],

    resize_keyboard: true,
    is_persistent: true
  }
}
    );

  } catch (err) {

    console.log(err);
  }
});

// =========================================
// MESSAGE
// =========================================

bot.on(
"message",
async (msg) => {

  try {

    if (!msg.text)
      return;

    const id =
    String(msg.from.id);

    initUser(id);

    if (userCooldown[id]) {
      return;
    }

    userCooldown[id] = true;

    setTimeout(() => {

      delete userCooldown[id];

    }, 3000);

    userDaily[id].commands++;

    if (
      userDaily[id].commands >
      COMMAND_LIMIT
    ) {

      return bot.sendMessage(
        msg.chat.id,

`⚠️ LIMITE DIÁRIO ATINGIDO`
      );
    }

    const text =
    msg.text;

    // =====================================
    // PRODUTOS
    // =====================================

    if (
      text === "📦 PRODUTOS"
    ) {

      userDaily[id].produtos++;

      if (
        userDaily[id].produtos >
        PRODUCT_LIMIT
      ) {

        return bot.sendMessage(
          msg.chat.id,

`⚠️ Limite produtos atingido`
        );
      }

      await bot.sendMessage(
        msg.chat.id,
        "⏳ Carregando produtos..."
      );

      const snap =
      await db
      .collection('produtos')
      .limit(50)
      .get();

      if (snap.empty) {

        return bot.sendMessage(
          msg.chat.id,
          "❌ Nenhum produto"
        );
      }

      const buttons = [];

      snap.forEach(doc => {

        const p =
        doc.data();

        if (
          (p.estoque || 0) > 0
        ) {

          buttons.push([{
            text:
`📦 ${p.nome} | R$ ${p.preco}`,

            callback_data:
`view_${doc.id}`
          }]);
        }
      });

      return bot.sendMessage(
        msg.chat.id,

`📦 LISTA DE PRODUTOS`,

{
  reply_markup: {
    inline_keyboard:
    buttons
  }
}
      );
    }

    // =====================================
    // INFO
    // =====================================

    if (
      text === "ℹ️ INFORMAÇÕES"
    ) {

      return bot.sendMessage(
        msg.chat.id,

`🚀 Sistema online`
      );
    }

    // =====================================
    // SUPORTE
    // =====================================

    if (
      text === "📲 SUPORTE"
    ) {

      return bot.sendMessage(
        msg.chat.id,

`https://wa.me/${WHATSAPP}`
      );
    }

  } catch (err) {

    console.log(err);
  }
});
