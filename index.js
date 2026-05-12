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

const LOGO =
"https://i.postimg.cc/g2JJvqHN/logo.jpg";

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
    // DIMINUIR ESTOQUE
    // =====================================

    const produtoRef =
    db
    .collection('produtos')
    .doc(info.produtoId);

    const produtoDoc =
    await produtoRef.get();

    if (produtoDoc.exists) {

      const produto =
      produtoDoc.data();

      const estoqueAtual =
      produto.estoque || 0;

      await produtoRef.update({

        estoque:
        Math.max(
          estoqueAtual - 1,
          0
        )
      });
    }

    // =====================================
    // HISTÓRICO
    // =====================================

    await db
    .collection('historico')
    .add({

      chatId:
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

`✅ PAGAMENTO APROVADO!

━━━━━━━━━━━━━━━━━━━

📦 Produto:
${info.produto}

💰 Valor:
R$ ${info.valor}

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

`💰 NOVA VENDA

📦 ${info.produto}

💲 R$ ${info.valor}

👤 ${info.chatId}`
    );

    res.sendStatus(200);

  } catch (err) {

    console.log(
      "❌ WEBHOOK ERROR:",
      err
    );

    res.sendStatus(500);
  }
}
);

// =========================================
// START
// =========================================

bot.onText(
/\/start/,
async (msg) => {

  try {

    await bot.sendPhoto(
      msg.chat.id,
      LOGO,
{
  caption:

`Olá 👋 seja bem-vindo(a)!

━━━━━━━━━━━━━━━━━━━

✅ Produtos digitais
✅ PIX automático
✅ Aprovação automática
✅ Entrega automática
✅ Sistema profissional

━━━━━━━━━━━━━━━━━━━

👇 Escolha abaixo`
}
    );

    await bot.sendMessage(
      msg.chat.id,

`⬛ MENU PRINCIPAL`,

{
  reply_markup: {

    keyboard: [

      [
        "📦 PRODUTOS",
        "🔍 PESQUISAR"
      ],

      [
        "ℹ️ INFO",
        "📲 SUPORTE"
      ]
    ],

    resize_keyboard: true,
    persistent: true
  }
}
    );

  } catch (err) {

    console.log(err);
  }
}
);

// =========================================
// PAINEL ADMIN SECRETO
// =========================================

bot.onText(
/\/dono26/,
async (msg) => {

  try {

    const userId =
    String(msg.from.id);

    if (
      userId !== MASTER &&
      !ADMINS.includes(userId)
    ) {

      return bot.sendMessage(
        msg.chat.id,
        "❌ Comando inexistente"
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
          "📊 DASHBOARD",

          callback_data:
          "admin_dash"
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

  } catch (err) {

    console.log(err);
  }
}
);

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
          "❌ Nenhum produto"
        );
      }

      const buttons = [];

      snap.forEach(doc => {

        const p =
        doc.data();

        buttons.push([
          {
            text:
`📦 ${p.nome} | R$ ${p.preco}`,

            callback_data:
`view_${doc.id}`
          }
        ]);
      });

      return bot.sendMessage(
        q.message.chat.id,

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

      const estoque =
      p.estoque || 0;

      const status =
      estoque > 0
      ? "🟢 Disponível"
      : "🔴 Esgotado";

      return bot.sendPhoto(
        q.message.chat.id,
        p.img,

{
  caption:

`📦 ${p.nome}

💰 R$ ${p.preco}

📝 ${p.desc}

📦 Estoque:
${estoque}

${status}`,

reply_markup: {
  inline_keyboard: [[{

    text:
    estoque > 0
    ? "🛒 COMPRAR"
    : "❌ ESGOTADO",

    callback_data:
    `buy_${doc.id}`

  }]]
}
}
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

      if (
        !p.estoque ||
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
      .doc(
        String(payment.id)
      )
      .set({

        produtoId:
        doc.id,

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

      return bot.sendPhoto(
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

📋 PIX:

${copia}

━━━━━━━━━━━━━━━━━━━

⏳ Expira em 5 minutos`
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

      userState[userId] = {
        step: "imagem"
      };

      return bot.sendMessage(
        q.message.chat.id,
        "🖼 Link da imagem:"
      );
    }

    // =====================================
    // ADMIN LISTAR
    // =====================================

    if (
      data === "admin_listar"
    ) {

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

`📦 ${p.nome}
💰 R$ ${p.preco}
📦 Estoque: ${p.estoque || 0}

`;
      });

      return bot.sendMessage(
        q.message.chat.id,
        texto
      );
    }

    // =====================================
    // DASHBOARD
    // =====================================

    if (
      data === "admin_dash"
    ) {

      const produtos =
      await db
      .collection('produtos')
      .get();

      const vendas =
      await db
      .collection('historico')
      .get();

      return bot.sendMessage(
        q.message.chat.id,

`📊 DASHBOARD

━━━━━━━━━━━━━━━━━━━

📦 Produtos:
${produtos.size}

💰 Vendas:
${vendas.size}

🚀 Sistema:
ONLINE`
      );
    }

  } catch (err) {

    console.log(err);
  }
}
);

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

    const text =
    msg.text;

    // =====================================
    // ANTI FLOOD
    // =====================================

    if (
      antiFlood[id] &&
      Date.now() - antiFlood[id] < 1000
    ) {
      return;
    }

    antiFlood[id] =
    Date.now();

    // =====================================
    // BUTTONS
    // =====================================

    if (
      text === "📦 PRODUTOS"
    ) {

      const snap =
      await db
      .collection('produtos')
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

        buttons.push([
          {
            text:
`📦 ${p.nome} | R$ ${p.preco}`,

            callback_data:
`view_${doc.id}`
          }
        ]);
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

    if (
      text === "ℹ️ INFO"
    ) {

      return bot.sendMessage(
        msg.chat.id,

`ℹ️ INFORMAÇÕES

🚀 Sistema online

👑 Desenvolvedor:
Faelzin`
      );
    }

    if (
      text === "📲 SUPORTE"
    ) {

      return bot.sendMessage(
        msg.chat.id,

`📲 SUPORTE

https://wa.me/${WHATSAPP}`
      );
    }

    // =====================================
    // ADD PRODUTO
    // =====================================

    const state =
    userState[id];

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
        "📦 Nome produto:"
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
        "💰 Valor:"
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
        "📝 Descrição:"
      );
    }

    if (
      state.step ===
      "descricao"
    ) {

      state.desc =
      text;

      state.step =
      "estoque";

      return bot.sendMessage(
        msg.chat.id,
        "📦 Estoque:"
      );
    }

    if (
      state.step ===
      "estoque"
    ) {

      state.estoque =
      Number(text);

      state.step =
      "link";

      return bot.sendMessage(
        msg.chat.id,
        "🔗 Link produto:"
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

        estoque:
        state.estoque,

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

`✅ PRODUTO ADICIONADO

📦 ${state.nome}
💰 R$ ${state.preco}
📦 Estoque:
${state.estoque}`
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
}
);
