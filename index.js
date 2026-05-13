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
  getFirestore,
  FieldValue
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

const SUPPORT =
"@suporte_inifnity_clientes_oficial";

const LOGO =
"https://i.postimg.cc/g2JJvqHN/logo.jpg";

const SECRET_ADMIN =
"/staff_dono";

const userState = {};
const antiFlood = {};
const adminAttempts = {};
const blockedUsers = {};

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

console.log("🔥 Firebase conectado");

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

  res.send("🚀 BOT ONLINE");
});

// =========================================
// ANTI FLOOD
// =========================================

function isFlood(id) {

  const now = Date.now();

  if (
    antiFlood[id] &&
    now - antiFlood[id] < 1500
  ) {
    return true;
  }

  antiFlood[id] = now;

  return false;
}

// =========================================
// BLOQUEIO TEMP
// =========================================

function isBlocked(id) {

  if (!blockedUsers[id])
    return false;

  if (
    Date.now() > blockedUsers[id]
  ) {

    delete blockedUsers[id];

    return false;
  }

  return true;
}

// =========================================
// MENU FLUTUANTE
// =========================================

async function sendFloatingMenu(chatId) {

  return bot.sendMessage(
    chatId,

`⚡ MENU SELLFORGE`,

{
  reply_markup: {
    inline_keyboard: [

      [
        {
          text: "📦 Produtos",
          callback_data:
          "menu_produtos"
        },

        {
          text: "🛒 Compras",
          callback_data:
          "menu_compras"
        }
      ],

      [
        {
          text: "📡 Status",
          callback_data:
          "menu_status"
        },

        {
          text: "📲 Suporte",
          url:
`https://t.me/${SUPPORT.replace("@","")}`
        }
      ]
    ]
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
      data.type !== "payment"
    ) {
      return res.sendStatus(200);
    }

    const payment =
    await mpPayment.get({
      id: data.data.id
    });

    if (
      payment.status !==
      "approved"
    ) {
      return res.sendStatus(200);
    }

    const vendaRef =
    db.collection('pagamentos')
    .doc(String(payment.id));

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

      status: "approved"
    });

    const produtoRef =
    db.collection('produtos')
    .doc(info.produtoId);

    const produtoDoc =
    await produtoRef.get();

    if (produtoDoc.exists) {

      const produto =
      produtoDoc.data();

      await produtoRef.update({

        estoque:
        Math.max(
          (produto.estoque || 1) - 1,
          0
        ),

        vendas:
        FieldValue.increment(1)
      });
    }

    await db
    .collection('historico')
    .add({

      user:
      info.chatId,

      produto:
      info.produto,

      valor:
      info.valor,

      createdAt:
      Date.now()
    });

    await bot.sendMessage(
      info.chatId,

`✅ PAGAMENTO APROVADO

━━━━━━━━━━━━━━━━━━━

📦 Produto:
${info.produto}

💰 Valor:
R$ ${info.valor}

👤 Vendedor:
${info.vendedor}

━━━━━━━━━━━━━━━━━━━

🔓 LINK:
${info.link}

🚀 Obrigado pela compra!`
    );

    await bot.sendMessage(
      MASTER,

`💸 NOVA VENDA

📦 ${info.produto}
💰 R$ ${info.valor}`
    );

    res.sendStatus(200);

  } catch (err) {

    console.log(
      "❌ WEBHOOK ERROR:",
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

    await bot.sendPhoto(
      chatId,
      LOGO,
{
  caption:

`🚀 Bem-vindo ao SellForge ⚡

✅ PIX automático
✅ Aprovação automática
✅ Entrega instantânea
✅ Painel ADMIN secreto

👑 Desenvolvido por Faelzin

📲 Suporte:
${SUPPORT}`
}
    );

    await sendFloatingMenu(chatId);

  } catch (err) {

    console.log(err);
  }
});

// =========================================
// ADMIN
// =========================================

bot.onText(
/\/staff_dono/,
async (msg) => {

  const userId =
  String(msg.from.id);

  if (
    userId !== MASTER
  ) {

    adminAttempts[userId] =
    (adminAttempts[userId] || 0) + 1;

    if (
      adminAttempts[userId] >= 2
    ) {

      blockedUsers[userId] =
      Date.now() + 60000;

      return bot.sendMessage(
        msg.chat.id,

`❌ 1/2 não têm autorização!

⚠️ Mais uma tentativa e seus comandos serão bloqueados.

🚫 Bloqueado por 1 minuto.`
      );
    }

    return bot.sendMessage(
      msg.chat.id,

`❌ Apenas proprietário do Bot tem autorização!

📲 Suporte:
${SUPPORT}`
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
        },

        {
          text:
          "📈 DASHBOARD",

          callback_data:
          "admin_dash"
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
});

// =========================================
// CALLBACKS
// =========================================

bot.on(
"callback_query",
async (q) => {

  try {

    const data =
    q.data;

    const userId =
    String(q.from.id);

    if (isBlocked(userId)) {

      return bot.answerCallbackQuery(
        q.id,
{
  text:
  "🚫 Você está bloqueado temporariamente"
}
      );
    }

    if (isFlood(userId)) {

      return bot.answerCallbackQuery(
        q.id,
{
  text:
  "⚠️ Evite spam"
}
      );
    }

    await bot.answerCallbackQuery(q.id);

    // =====================================
    // PRODUTOS
    // =====================================

    if (
      data === "menu_produtos"
    ) {

      const snap =
      await db
      .collection('produtos')
      .get();

      if (snap.empty) {

        return bot.sendMessage(
          q.message.chat.id,
          "❌ Nenhum produto"
        );
      }

      const buttons = [];

      snap.forEach(doc => {

        const p =
        doc.data();

        buttons.push([{

          text:
`${p.nome} | R$ ${p.preco}`,

          callback_data:
`view_${doc.id}`

        }]);
      });

      return bot.sendMessage(
        q.message.chat.id,

`📦 PRODUTOS DISPONÍVEIS`,

{
  reply_markup: {
    inline_keyboard:
    buttons
  }
}
      );
    }

    // =====================================
    // STATUS
    // =====================================

    if (
      data === "menu_status"
    ) {

      return bot.sendMessage(
        q.message.chat.id,

`📡 STATUS BOT

🟢 BOT ONLINE
🟢 FIREBASE ONLINE
🟢 MERCADO PAGO ONLINE
🟢 WEBHOOK ONLINE`
      );
    }

    // =====================================
    // VIEW PRODUTO
    // =====================================

    if (
      data.startsWith("view_")
    ) {

      const id =
      data.replace(
        "view_",
        ""
      );

      const doc =
      await db
      .collection('produtos')
      .doc(id)
      .get();

      if (!doc.exists)
        return;

      const p =
      doc.data();

      return bot.sendPhoto(
        q.message.chat.id,
        p.img,

{
  caption:

`📦 ${p.nome}

👤 Vendedor:
${p.vendedor}

💰 Valor:
R$ ${p.preco}

📦 Estoque:
${p.estoque || 0}

📝 ${p.desc}`,

  reply_markup: {
    inline_keyboard: [[{

      text:
      "🛒 COMPRAR",

      callback_data:
      `buy_${doc.id}`

    }]]
  }
}
      );
    }

    // =====================================
    // CANCELAR
    // =====================================

    if (
      data === "cancel_buy"
    ) {

      return bot.sendMessage(
        q.message.chat.id,
        "❌ Compra cancelada"
      );
    }

    // =====================================
    // BUY
    // =====================================

    if (
      data.startsWith("buy_")
    ) {

      await bot.sendMessage(
        q.message.chat.id,

`⚠️ Compre somente com administrador oficial.
Evite golpes!`
      );

      const id =
      data.replace(
        "buy_",
        ""
      );

      const doc =
      await db
      .collection('produtos')
      .doc(id)
      .get();

      if (!doc.exists)
        return;

      const p =
      doc.data();

      if (
        p.estoque <= 0
      ) {

        return bot.sendMessage(
          q.message.chat.id,
          "❌ Produto esgotado"
        );
      }

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

      const qr =
      payment
      .point_of_interaction
      ?.transaction_data
      ?.qr_code_base64;

      const copia =
      payment
      .point_of_interaction
      ?.transaction_data
      ?.qr_code;

      if (!qr || !copia) {

        return bot.sendMessage(
          q.message.chat.id,
          "❌ Erro ao gerar PIX"
        );
      }

      await db
      .collection('pagamentos')
      .doc(String(payment.id))
      .set({

        chatId:
        q.message.chat.id,

        produtoId:
        doc.id,

        produto:
        p.nome,

        valor:
        p.preco,

        vendedor:
        p.vendedor,

        link:
        p.link,

        aprovado:
        false,

        createdAt:
        Date.now()
      });

      return bot.sendPhoto(
        q.message.chat.id,

        Buffer.from(
          qr,
          'base64'
        ),

{
  caption:

`💳 PAGAMENTO PIX

📦 ${p.nome}

💰 R$ ${p.preco}

📲 PIX COPIA E COLA:

${copia}

⏳ Aprovação automática.`,

reply_markup: {
  inline_keyboard: [[
    {
      text:
      "❌ Cancelar Compra",

      callback_data:
      "cancel_buy"
    }
  ]]
}
}
      );
    }

  } catch (err) {

    console.log(
      "❌ CALLBACK:",
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
`🚀
