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
  }
);

// =========================================
// HOME
// =========================================

app.get('/', (req, res) => {

  res.send(
    "🚀 BOT ONLINE"
  );
});

// =========================================
// WEBHOOK MERCADO PAGO
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

    await bot.sendMessage(
      info.chatId,

`✅ PAGAMENTO APROVADO

━━━━━━━━━━━━━━━━━━━

📦 Produto:
${info.produto}

💰 Valor:
R$ ${info.valor}

━━━━━━━━━━━━━━━━━━━

🔗 LINK LIBERADO:

${info.link}

━━━━━━━━━━━━━━━━━━━

🚀 Obrigado pela compra!`
    );

    res.sendStatus(200);

  } catch (err) {

    console.log(
      "❌ ERRO WEBHOOK:",
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

    await bot.sendPhoto(
      chatId,
      LOGO,
{
  caption:

`👋 Olá, seja bem-vindo(a)!

━━━━━━━━━━━━━━━━━━━

🚀 INFINITY CLIENTES

Sistema automático
de vendas online.

━━━━━━━━━━━━━━━━━━━

⚡ Entrega automática
✅ Aprovação instantânea
💳 Pagamento seguro
🎧 Suporte rápido
⭐ Produtos premium

━━━━━━━━━━━━━━━━━━━

⚠️ Não caia em golpes.
Compre apenas pelo
canal oficial.

━━━━━━━━━━━━━━━━━━━

🛒 Escolha uma opção abaixo`
}
    );

    // =====================================
    // KEYBOARD FLUTUANTE
    // =====================================

    await bot.sendMessage(
      chatId,
      "👇 MENU RÁPIDO",
{
  reply_markup: {

    keyboard: [

      [
        {
          text:
          "🛍 Produtos"
        },

        {
          text:
          "🔥 Promoções"
        }
      ],

      [
        {
          text:
          "📦 Pedidos"
        },

        {
          text:
          "🎧 Suporte"
        }
      ],

      [
        {
          text:
          "💳 Pagamentos"
        },

        {
          text:
          "ℹ️ Informações"
        }
      ],

      [
        {
          text:
          "👑 Painel Cliente"
        }
      ]

    ],

    resize_keyboard: true

  }
}
    );

    // =====================================
    // PAINEL ADMIN
    // =====================================

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
          "🗑 LIMPAR",

          callback_data:
          "admin_limpar"
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
// MENSAGENS KEYBOARD
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
    // PRODUTOS
    // =====================================

    if (
      text === "🛍 Produtos"
    ) {

      const snap =
      await db
      .collection('produtos')
      .get();

      if (snap.empty) {

        return bot.sendMessage(
          msg.chat.id,
          "❌ Nenhum produto cadastrado"
        );
      }

      const buttons = [];

      snap.forEach(doc => {

        const p =
        doc.data();

        buttons.push([
          {
            text:
`📦 ${p.nome} - R$ ${p.preco}`,

            callback_data:
`view_${doc.id}`
          }
        ]);
      });

      return bot.sendMessage(
        msg.chat.id,

`🛍 LISTA DE PRODUTOS

Escolha um produto abaixo 👇`,

{
  reply_markup: {
    inline_keyboard:
    buttons
  }
}
      );
    }

    // =====================================
    // SUPORTE
    // =====================================

    if (
      text === "🎧 Suporte"
    ) {

      return bot.sendMessage(
        msg.chat.id,

`📲 SUPORTE OFICIAL

Clique abaixo:`,

{
  reply_markup: {
    inline_keyboard: [[{

      text:
      "ABRIR WHATSAPP",

      url:
`https://wa.me/${WHATSAPP}`

    }]]
  }
}
      );
    }

    // =====================================
    // INFORMAÇÕES
    // =====================================

    if (
      text === "ℹ️ Informações"
    ) {

      return bot.sendMessage(
        msg.chat.id,

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
    // PROMOÇÕES
    // =====================================

    if (
      text === "🔥 Promoções"
    ) {

      return bot.sendMessage(
        msg.chat.id,

`🔥 PROMOÇÕES

Ganhe até 80% OFF
em produtos selecionados.`
      );
    }

    // =====================================
    // PAGAMENTOS
    // =====================================

    if (
      text === "💳 Pagamentos"
    ) {

      return bot.sendMessage(
        msg.chat.id,

`💳 FORMAS DE PAGAMENTO

✅ PIX
✅ Mercado Pago
✅ Aprovação automática`
      );
    }

    // =====================================
    // PEDIDOS
    // =====================================

    if (
      text === "📦 Pedidos"
    ) {

      return bot.sendMessage(
        msg.chat.id,

`📦 Seus pedidos serão
liberados automaticamente
após confirmação do pagamento.`
      );
    }

    // =====================================
    // PAINEL CLIENTE
    // =====================================

    if (
      text === "👑 Painel Cliente"
    ) {

      return bot.sendMessage(
        msg.chat.id,

`👑 PAINEL CLIENTE

🚀 Conta ativa
✅ Sistema online`
      );
    }

    // =====================================
    // FLUXO ADD PRODUTO
    // =====================================

    if (
      text.startsWith("/")
    ) return;

    if (!state)
      return;

    // NOME

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
        "💰 Valor:"
      );
    }

    // VALOR

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
        "📝 Descrição:"
      );
    }

    // DESCRIÇÃO

    if (
      state.step ===
      "descricao"
    ) {

      state.desc =
      text;

      state.step =
      "imagem";

      return bot.sendMessage(
        msg.chat.id,
        "🖼 Link da imagem:"
      );
    }

    // IMAGEM

    if (
      state.step ===
      "imagem"
    ) {

      state.img =
      text;

      state.step =
      "link";

      return bot.sendMessage(
        msg.chat.id,
        "🔗 Link produto:"
      );
    }

    // LINK

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

        link:
        text,

        createdAt:
        Date.now()
      });

      userState[id] =
      null;

      return bot.sendMessage(
        msg.chat.id,
        "✅ Produto adicionado"
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

    await bot.answerCallbackQuery(
      q.id
    );

    const data =
    q.data;

    const userId =
    String(q.from.id);

    // =====================================
    // VER PRODUTO
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

💰 Valor:
R$ ${p.preco}

📝 Descrição:
${p.desc}`,

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
    // ADMIN ADD
    // =====================================

    if (
      data ===
      "admin_add"
    ) {

      if (
        userId !== MASTER &&
        !ADMINS.includes(userId)
      ) return;

      userState[userId] = {
        step: "produto"
      };

      return bot.sendMessage(
        q.message.chat.id,

`📦 CADASTRAR PRODUTO

Envie o nome do produto:`
      );
    }

    // =====================================
    // ADMIN LISTAR
    // =====================================

    if (
      data ===
      "admin_listar"
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

      let texto =
"📦 PRODUTOS\n\n";

      snap.forEach(doc => {

        const p =
        doc.data();

        texto +=

`🆔 ${doc.id}

📦 ${p.nome}
💰 R$ ${p.preco}

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
      data ===
      "admin_limpar"
    ) {

      if (
        userId !== MASTER
      ) return;

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

      return bot.sendMessage(
        q.message.chat.id,
        "🗑 Produtos deletados"
      );
    }

    // =====================================
    // COMPRAR
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
          "❌ Produto não encontrado"
        );
      }

      const p =
      doc.data();

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

        valor:
        p.preco,

        link:
        p.link,

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

`💳 PAGAMENTO PIX

━━━━━━━━━━━━━━━━━━━

📦 ${p.nome}

💰 Valor:
R$ ${p.preco}

━━━━━━━━━━━━━━━━━━━

📋 PIX COPIA E COLA:

${copia}

━━━━━━━━━━━━━━━━━━━

⏳ Aguardando pagamento...`
}
      );
    }

  } catch (err) {

    console.log(
      "❌ CALLBACK ERROR:",
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
}
);
