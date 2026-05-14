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

const SUPPORT =
"@suporte_inifnity_clientes_oficial";

const LOGO =
"https://i.postimg.cc/g2JJvqHN/logo.jpg";

const BOT_USERNAME =
"SellForge_bot";

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
  Date.now() + (
    30 * 24 * 60 * 60 * 1000
  )
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
      "LOG ERROR:",
      err
    );
  }
}

// =========================================
// SPAM
// =========================================

function isBlocked(userId) {

  if (!blockedUsers[userId])
    return false;

  return Date.now() <
  blockedUsers[userId];
}

function addSpam(userId) {

  if (!spamControl[userId]) {

    spamControl[userId] = {
      count: 0
    };
  }

  spamControl[userId].count++;

  if (
    spamControl[userId].count >= 5
  ) {

    blockedUsers[userId] =
    Date.now() + 60000;

    spamControl[userId].count = 0;

    return true;
  }

  return false;
}

// =========================================
// ADMIN
// =========================================

function isAdminBanned(userId) {

  if (!bannedAdmins[userId])
    return false;

  return Date.now() <
  bannedAdmins[userId];
}

function isAdminExpired(userId) {

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

async function sendKeyboard(chatId) {

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
    // ESTOQUE
    // =====================================

    const produtoRef =
    db.collection('produtos')
    .doc(info.produtoId);

    const produtoDoc =
    await produtoRef.get();

    if (produtoDoc.exists) {

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
        (produto.vendas || 0) + 1
      });
    }

    // =====================================
    // ENTREGA
    // =====================================

    await bot.sendMessage(
      info.chatId,

`✅ PAGAMENTO APROVADO

📦 Produto:
${info.produto}

💰 Valor:
R$ ${info.valor}

🔓 LINK:

${info.link}

🚀 Obrigado pela compra`
    );

    await adminLog(

`💰 PAGAMENTO APROVADO

📦 ${info.produto}

💵 ${info.valor}`
    );

    res.sendStatus(200);

  } catch (err) {

    console.log(
      "WEBHOOK ERROR:",
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

`🚀 SELLFORGE MARKETPLACE

✅ PIX automático
✅ Entrega instantânea
✅ Estoque automático
✅ Segurança premium

📲 Suporte:
${SUPPORT}`
}
    );

    await sendKeyboard(chatId);

  } catch (err) {

    console.log(err);
  }
});

// =========================================
// STAFF
// =========================================

bot.onText(
/\/staff_dono/,
async (msg) => {

  const userId =
  String(msg.from.id);

  if (
    userId !== MASTER &&
    !ADMINS.includes(userId)
  ) {

    return;
  }

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
});

// =========================================
// CALLBACK
// =========================================

bot.on(
"callback_query",
async (q) => {

  try {

    if (!q.message)
      return;

    const data =
    q.data;

    const userId =
    String(q.from.id);

    await bot.answerCallbackQuery(
      q.id
    );

    if (
      isAdminBanned(userId)
    ) {

      return bot.sendMessage(
        q.message.chat.id,

`⛔ Identificamos tentativas não autorizadas dentro painel ADMIN.`
      );
    }

    // =====================================
    // MENU PRODUTOS
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
          "❌ Sem produtos"
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
        q.message.chat.id,

`📦 PRODUTOS`,

{
  reply_markup: {
    inline_keyboard:
    buttons
  }
}
      );
    }

    // =====================================
    // VIEW
    // =====================================

    if (
      data.startsWith(
        "view_"
      )
    ) {

      const idProduto =
      data.replace(
        "view_",
        ""
      );

      const doc =
      await db
      .collection('produtos')
      .doc(idProduto)
      .get();

      if (!doc.exists) {

        return bot.sendMessage(
          q.message.chat.id,
          "❌ Produto não encontrado"
        );
      }

      const p =
      doc.data();

      return bot.sendPhoto(
        q.message.chat.id,
        p.img,

{
  caption:

`📦 ${p.nome}

💰 R$ ${p.preco}

📦 Estoque:
${p.estoque}`,

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
    // BUY
    // =====================================

    if (
      data.startsWith(
        "buy_"
      )
    ) {

      const idProduto =
      data.replace(
        "buy_",
        ""
      );

      const doc =
      await db
      .collection('produtos')
      .doc(idProduto)
      .get();

      if (!doc.exists) {

        return bot.sendMessage(
          q.message.chat.id,
          "❌ Produto removido"
        );
      }

      const p =
      doc.data();

      if (
        p.estoque <= 0
      ) {

        return bot.sendMessage(
          q.message.chat.id,
          "❌ Produto sem estoque"
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

        produtoId:
        idProduto,

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

PIX:

${copia}`
}
      );
    }

    // =====================================
    // ADMIN ADD
    // =====================================

    if (
      data === "admin_add"
    ) {

      if (
        userId !== MASTER &&
        !ADMINS.includes(userId)
      ) return;

      if (
        !adminCanAction(
          userId,
          "add"
        )
      ) {

        return bot.sendMessage(
          q.message.chat.id,

`⚠️ Limite diário atingido`
        );
      }

      adminLimits[userId]
      .add++;

      userState[userId] = {
        step: "imagem"
      };

      await adminLog(

`➕ ADMIN INICIOU ADD

👤 ${userId}`
      );

      return bot.sendMessage(
        q.message.chat.id,

`📸 Envie imagem`
      );
    }

    // =====================================
    // ADMIN LISTAR
    // =====================================

    if (
      data === "admin_listar"
    ) {

      if (
        userId !== MASTER &&
        !ADMINS.includes(userId)
      ) return;

      const snap =
      await db
      .collection('produtos')
      .get();

      let texto =
"📦 PRODUTOS\n\n";

      snap.forEach(doc => {

        const p =
        doc.data();

        texto +=

`🆔 ${doc.id}

📦 ${p.nome}
💰 ${p.preco}
📦 ${p.estoque}

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

    if (
      data === "admin_limpar"
    ) {

      if (
        userId === MASTER
      ) {

        const snap =
        await db
        .collection('produtos')
        .get();

        for (
          const doc
          of snap.docs
        ) {

          await db
          .collection('produtos')
          .doc(doc.id)
          .delete();
        }

        await adminLog(

`🔥 MASTER LIMPOU PRODUTOS`
        );

        return bot.sendMessage(
          q.message.chat.id,
          "🗑 Produtos removidos"
        );
      }

      if (
        ADMINS.includes(userId)
      ) {

        bannedAdmins[userId] =
        Date.now() + (
          60 * 60 * 1000
        );

        await adminLog(

`🚨 ADMIN BANIDO

👤 ${userId}

Motivo:
Tentou limpar produtos`
        );

        return bot.sendMessage(
          q.message.chat.id,

`⛔ Identificamos tentativas não autorizadas dentro painel ADMIN.

🚫 ADMIN bloqueado por 1 hora.`
        );
      }
    }

  } catch (err) {

    console.log(
      "CALLBACK ERROR:",
      err
    );
  }
});

// =========================================
// MENSAGENS
// =========================================

bot.on(
"message",
async (msg) => {

  try {

    if (!msg.text)
      return;

    const text =
    msg.text;

    const id =
    String(msg.from.id);

    const state =
    userState[id];

    // =====================================
    // TECLADO
    // =====================================

    if (
      text === "📦 Produtos"
    ) {

      const snap =
      await db
      .collection('produtos')
      .get();

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
        msg.chat.id,

`📦 PRODUTOS`,

{
  reply_markup: {
    inline_keyboard:
    buttons
  }
}
      );
    }

    if (
      text === "📡 Status"
    ) {

      return bot.sendMessage(
        msg.chat.id,

`🟢 ONLINE`
      );
    }

    if (
      text === "📲 Suporte"
    ) {

      return bot.sendMessage(
        msg.chat.id,

`https://wa.me/${WHATSAPP}`
      );
    }

    if (
      text === "🛒 Compras"
    ) {

      return bot.sendMessage(
        msg.chat.id,

`🛒 Em breve`
      );
    }

    // =====================================
    // ADD PRODUTO
    // =====================================

    if (
      text.startsWith("/")
    ) return;

    if (!state)
      return;

    if (
      state.step ===
      "imagem"
    ) {

      state.img =
      text;

      state.step =
      "produto";

      return bot.sendMessage(
        msg.chat.id,
        "📦 Nome produto"
      );
    }

    if (
      state.step ===
      "produto"
    ) {

      state.nome =
      text;

      state.step =
      "valor";

      return bot.sendMessage(
        msg.chat.id,
        "💰 Valor"
      );
    }

    if (
      state.step ===
      "valor"
    ) {

      state.preco =
      Number(
        text.replace(",", ".")
      );

      state.step =
      "descricao";

      return bot.sendMessage(
        msg.chat.id,
        "📝 Descrição"
      );
    }

    if (
      state.step ===
      "descricao"
    ) {

      state.desc =
      text;

      state.step =
      "whatsapp";

      return bot.sendMessage(
        msg.chat.id,
        "📲 WhatsApp"
      );
    }

    if (
      state.step ===
      "whatsapp"
    ) {

      state.whatsapp =
      text;

      state.step =
      "estoque";

      return bot.sendMessage(
        msg.chat.id,
        "📦 Estoque"
      );
    }

    if (
      state.step ===
      "estoque"
    ) {

      const estoque =
      Number(text);

      if (
        estoque < 0
      ) {

        return bot.sendMessage(
          msg.chat.id,
          "❌ Estoque inválido"
        );
      }

      state.estoque =
      estoque;

      state.step =
      "link";

      return bot.sendMessage(
        msg.chat.id,
        "🔗 Link produto"
      );
    }

    if (
      state.step ===
      "link"
    ) {

      await db
      .collection('produtos')
      .add({

        nome:
        state.nome,

        preco:
        state.preco,

        desc:
        state.desc,

        img:
        state.img,

        whatsapp:
        state.whatsapp,

        estoque:
        state.estoque,

        vendas: 0,

        link:
        text,

        createdAt:
        Date.now()
      });

      await adminLog(

`➕ PRODUTO CRIADO

📦 ${state.nome}

👤 ${id}`
      );

      userState[id] =
      null;

      return bot.sendMessage(
        msg.chat.id,

`✅ PRODUTO ADICIONADO`
      );
    }

  } catch (err) {

    console.log(
      "MESSAGE ERROR:",
      err
    );
  }
});

// =========================================
// BANIR ADMIN
// =========================================

bot.onText(
/\/banir_admin (.+)/,
async (msg, match) => {

  const userId =
  String(msg.from.id);

  if (
    userId !== MASTER
  ) return;

  const alvo =
  match[1];

  bannedAdmins[alvo] =
  Date.now() + (
    60 * 60 * 1000
  );

  bot.sendMessage(
    msg.chat.id,

`⛔ ADMIN BANIDO`
  );
}
);

// =========================================
// DESBANIR ADMIN
// =========================================

bot.onText(
/\/desbanir_admin (.+)/,
async (msg, match) => {

  const userId =
  String(msg.from.id);

  if (
    userId !== MASTER
  ) return;

  const alvo =
  match[1];

  delete bannedAdmins[alvo];

  bot.sendMessage(
    msg.chat.id,

`✅ ADMIN DESBANIDO`
  );
}
);

// =========================================
// SERVER
// =========
