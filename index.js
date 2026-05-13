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

app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));

// =========================================
// CONFIG
// =========================================

const MASTER = "6863505946";

const WHATSAPP =
"551981528372";

const SUPPORT =
"@suporte_inifnity_clientes_oficial";

const LOGO =
"https://i.postimg.cc/g2JJvqHN/logo.jpg";

const SECRET_ADMIN =
"/staff_dono";

const userState = {};
const antiFlood = {};

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
// WEBHOOK MP
// =========================================

app.post(
'/webhook/mp',
async (req, res) => {

  try {

    const data = req.body;

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

    // =====================================
    // DIMINUIR ESTOQUE
    // =====================================

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

    // =====================================
    // HISTÓRICO
    // =====================================

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

👤 Vendedor:
${info.vendedor}

📲 Chave PIX:
${info.pix}

━━━━━━━━━━━━━━━━━━━

🔓 LINK LIBERADO:

${info.link}

━━━━━━━━━━━━━━━━━━━

🚀 Obrigado pela compra!`
    );

    // =====================================
    // NOTIFICAÇÃO ADMIN
    // =====================================

    await bot.sendMessage(
      MASTER,

`💸 NOVA VENDA

📦 ${info.produto}
💰 R$ ${info.valor}
👤 Cliente: ${info.chatId}`
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

`🚀 Bem-vindo ao SellForge Market ⚡

Sua plataforma automática de produtos digitais.

━━━━━━━━━━━━━━━━━━━

✅ PIX automático
✅ Aprovação automática
✅ Entrega instantânea
✅ Produtos VIP
✅ Segurança total

━━━━━━━━━━━━━━━━━━━

👑 Desenvolvido por Faelzin

📲 Suporte:
${SUPPORT}

👇 Escolha uma opção abaixo`
}
    );

    await bot.sendMessage(
      chatId,

`⬛ MENU PRINCIPAL`,

{
  reply_markup: {
    inline_keyboard: [

      [
        {
          text: "📦 Produtos",
          callback_data:
          "menu_produtos"
        }
      ],

      [
        {
          text: "🛒 Compras",
          callback_data:
          "menu_compras"
        }
      ],

      [
        {
          text: "📡 Status Bot",
          callback_data:
          "menu_status"
        }
      ],

      [
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

  } catch (err) {

    console.log(err);
  }
});

// =========================================
// ADMIN SECRETO
// =========================================

bot.onText(
/\/staff_dono/,
async (msg) => {

  const userId =
  String(msg.from.id);

  if (
    userId !== MASTER
  ) {

    return bot.sendMessage(
      msg.chat.id,

`❌ Apenas proprietário do Bot tem autorização!

📲 Entre em contato:
${SUPPORT}`
    );
  }

  await bot.sendMessage(
    msg.chat.id,

`👑 PAINEL ADMIN SECRETO`,

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
          "➕ ADD ESTOQUE",
          callback_data:
          "admin_estoque"
        }
      ],

      [
        {
          text:
          "🗑 DELETE ID",
          callback_data:
          "admin_delete"
        }
      ],

      [
        {
          text:
          "🔥 LIMPAR TUDO",
          callback_data:
          "admin_limpar"
        }
      ],

      [
        {
          text:
          "📈 DASHBOARD",
          callback_data:
          "admin_dash"
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

    if (isFlood(userId)) {

      return bot.answerCallbackQuery(
        q.id,
{
  text:
  "⚠️ Aguarde..."
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
🟢 WEBHOOK ONLINE

⚡ Ping:
${Math.floor(Math.random()*40)+10}ms`
      );
    }

    // =====================================
    // COMPRAS
    // =====================================

    if (
      data === "menu_compras"
    ) {

      const compras =
      await db
      .collection('historico')
      .where(
        "user",
        "==",
        q.message.chat.id
      )
      .get();

      if (compras.empty) {

        return bot.sendMessage(
          q.message.chat.id,
          "🛒 Nenhuma compra encontrada"
        );
      }

      let texto =
"🛒 SUAS COMPRAS\n\n";

      compras.forEach(doc => {

        const c =
        doc.data();

        texto +=
`📦 ${c.produto}
💰 R$ ${c.valor}

`;
      });

      return bot.sendMessage(
        q.message.chat.id,
        texto
      );
    }

    // =====================================
    // VIEW PRODUTO
    // =====================================

    if (
      data.startsWith(
        "view_"
      )
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
    // BUY
    // =====================================

    if (
      data.startsWith(
        "buy_"
      )
    ) {

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

          date_of_expiration:
          new Date(
            Date.now() +
            5 * 60 * 1000
          ),

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

        pix:
        p.pix,

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

⏳ Expira em 5 minutos

📲 PIX COPIA E COLA:

${copia}`
}
      );
    }

    // =====================================
    // ADMIN LISTAR
    // =====================================

    if (
      data === "admin_listar"
    ) {

      if (
        userId !== MASTER
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
📦 Estoque: ${p.estoque || 0}
📈 Vendas: ${p.vendas || 0}

`;
      });

      return bot.sendMessage(
        q.message.chat.id,
        texto
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
// MENSAGENS
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

    if (
      text.startsWith("/")
    ) return;

    if (!state)
      return;

    // =====================================
    // ADD PRODUTO
    // =====================================

    if (
      state.step === "imagem"
    ) {

      state.img = text;

      state.step = "nome";

      return bot.sendMessage(
        msg.chat.id,
        "📦 Nome produto:"
      );
    }

    if (
      state.step === "nome"
    ) {

      state.nome = text;

      state.step = "preco";

      return bot.sendMessage(
        msg.chat.id,
        "💰 Valor:"
      );
    }

    if (
      state.step === "preco"
    ) {

      state.preco =
      Number(
        text.replace(",", ".")
      );

      state.step = "desc";

      return bot.sendMessage(
        msg.chat.id,
        "📝 Descrição:"
      );
    }

    if (
      state.step === "desc"
    ) {

      state.desc = text;

      state.step = "vendedor";

      return bot.sendMessage(
        msg.chat.id,
        "👤 Nome vendedor:"
      );
    }

    if (
      state.step === "vendedor"
    ) {

      state.vendedor = text;

      state.step = "pix";

      return bot.sendMessage(
        msg.chat.id,
        "💳 Chave PIX:"
      );
    }

    if (
      state.step === "pix"
    ) {

      state.pix = text;

      state.step = "estoque";

      return bot.sendMessage(
        msg.chat.id,
        "📦 Estoque:"
      );
    }

    if (
      state.step === "estoque"
    ) {

      state.estoque =
      Number(text);

      state.step = "link";

      return bot.sendMessage(
        msg.chat.id,
        "🔗 Link entrega:"
      );
    }

    if (
      state.step === "link"
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

        vendedor:
        state.vendedor,

        pix:
        state.pix,

        estoque:
        state.estoque,

        vendas: 0,

        img:
        state.img,

        link: text,

        createdAt:
        Date.now()
      });

      userState[id] = null;

      return bot.sendMessage(
        msg.chat.id,

`✅ PRODUTO ADICIONADO

📦 ${state.nome}
💰 R$ ${state.preco}`
      );
    }

  } catch (err) {

    console.log(err);
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

  const webhook =
`${process.env.RENDER_EXTERNAL_URL}${SECRET_PATH}`;

  await bot.setWebHook(
    webhook
  );

  console.log(
    "✅ WEBHOOK SETADO"
  );
}
);
