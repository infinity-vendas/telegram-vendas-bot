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

app.use(express.json());

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
const cooldown = {};

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
// MENU FLUTUANTE
// =========================================

async function enviarMenu(chatId) {

  await bot.sendMessage(
    chatId,
    "⬇️ MENU PRINCIPAL",
{
  reply_markup: {

    keyboard: [

      [
        {
          text:
          "📦 Produtos"
        },

        {
          text:
          "🔥 Ranking"
        }
      ],

      [
        {
          text:
          "📜 Compras"
        },

        {
          text:
          "ℹ️ Informações"
        }
      ],

      [
        {
          text:
          "📲 Suporte"
        }
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

      await produtoRef.update({

        estoque:
        Math.max(
          (produto.estoque || 1) - 1,
          0
        ),

        vendidos:
        (produto.vendidos || 0) + 1
      });
    }

    // =====================================
    // HISTÓRICO
    // =====================================

    await db
    .collection('historico')
    .add({

      userId:
      info.userId,

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

🔓 LINK LIBERADO:

${info.link}

━━━━━━━━━━━━━━━━━━━

🚀 Obrigado pela compra!`
    );

    // =====================================
    // AVALIAÇÃO
    // =====================================

    await bot.sendMessage(
      info.chatId,

`⭐ Avalie sua compra

⭐⭐⭐⭐⭐`
    );

    // =====================================
    // NOTIFICAÇÃO ADMIN
    // =====================================

    const admins =
    [MASTER, ...ADMINS];

    for (const admin of admins) {

      await bot.sendMessage(
        admin,

`💰 NOVA VENDA

📦 ${info.produto}

💵 R$ ${info.valor}`
      );
    }

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
/\/start/,
async (msg) => {

  const chatId =
  msg.chat.id;

  const userId =
  String(msg.from.id);

  await bot.sendPhoto(
    chatId,
    LOGO,
{
  caption:

`🚀 Bem-vindo(a)

✅ Produtos digitais
✅ PIX automático
✅ Entrega automática
✅ Sistema profissional`
}
  );

  await enviarMenu(chatId);

  // USERS

  await db
  .collection('usuarios')
  .doc(userId)
  .set({

    userId,
    createdAt:
    Date.now()

  }, { merge: true });

  // ADMIN

  if (
    userId === MASTER ||
    ADMINS.includes(userId)
  ) {

    await bot.sendMessage(
      chatId,

`👑 PAINEL ADMIN`,

{
  reply_markup: {
    inline_keyboard: [

      [
        {
          text:
          "📊 DASHBOARD",

          callback_data:
          "dashboard"
        }
      ],

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
      ]
    ]
  }
}
    );
  }
});

// =========================================
// BOTÕES MENU
// =========================================

bot.on(
'message',
async (msg) => {

  try {

    if (!msg.text)
      return;

    const text =
    msg.text;

    const chatId =
    msg.chat.id;

    const userId =
    String(msg.from.id);

    // =====================================
    // FLOOD
    // =====================================

    if (
      cooldown[userId] &&
      Date.now() <
      cooldown[userId]
    ) {

      return;
    }

    cooldown[userId] =
    Date.now() + 3000;

    // =====================================
    // PRODUTOS
    // =====================================

    if (
      text ===
      "📦 Produtos"
    ) {

      const snap =
      await db
      .collection('categorias')
      .get();

      if (snap.empty) {

        return bot.sendMessage(
          chatId,
          "❌ Nenhuma categoria"
        );
      }

      const buttons = [];

      snap.forEach(doc => {

        buttons.push([{
          text:
          doc.id,

          callback_data:
          `cat_${doc.id}`
        }]);
      });

      return bot.sendMessage(
        chatId,

`📂 Categorias`,

{
  reply_markup: {
    inline_keyboard:
    buttons
  }
}
      );
    }

    // =====================================
    // HISTÓRICO
    // =====================================

    if (
      text ===
      "📜 Compras"
    ) {

      const compras =
      await db
      .collection('historico')
      .where(
        "userId",
        "==",
        userId
      )
      .get();

      if (compras.empty) {

        return bot.sendMessage(
          chatId,
          "❌ Nenhuma compra"
        );
      }

      let txt =
      "📜 HISTÓRICO\n\n";

      compras.forEach(doc => {

        const c =
        doc.data();

        txt +=
`📦 ${c.produto}
💰 R$ ${c.valor}

`;
      });

      return bot.sendMessage(
        chatId,
        txt
      );
    }

    // =====================================
    // RANKING
    // =====================================

    if (
      text ===
      "🔥 Ranking"
    ) {

      const ranking =
      await db
      .collection('produtos')
      .orderBy(
        "vendidos",
        "desc"
      )
      .limit(10)
      .get();

      let txt =
      "🔥 MAIS VENDIDOS\n\n";

      ranking.forEach(doc => {

        const p =
        doc.data();

        txt +=
`📦 ${p.nome}
🔥 ${p.vendidos || 0} vendas

`;
      });

      return bot.sendMessage(
        chatId,
        txt
      );
    }

    // =====================================
    // INFO
    // =====================================

    if (
      text ===
      "ℹ️ Informações"
    ) {

      return bot.sendMessage(
        chatId,

`🚀 Sistema online

👑 Desenvolvedor:
Faelzin`
      );
    }

    // =====================================
    // SUPORTE
    // =====================================

    if (
      text ===
      "📲 Suporte"
    ) {

      return bot.sendMessage(
        chatId,

`https://wa.me/${WHATSAPP}`
      );
    }

    // =====================================
    // PESQUISA
    // =====================================

    const busca =
    await db
    .collection('produtos')
    .where(
      "nome",
      ">=",
      text
    )
    .get();

    if (!busca.empty) {

      const buttons = [];

      busca.forEach(doc => {

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
        chatId,

`🔎 Resultado da pesquisa`,

{
  reply_markup: {
    inline_keyboard:
    buttons
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
'callback_query',
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
    // DASHBOARD
    // =====================================

    if (
      data ===
      "dashboard"
    ) {

      if (
        userId !== MASTER &&
        !ADMINS.includes(userId)
      ) return;

      const produtos =
      await db
      .collection('produtos')
      .get();

      const users =
      await db
      .collection('usuarios')
      .get();

      const vendas =
      await db
      .collection('historico')
      .get();

      let total = 0;

      vendas.forEach(doc => {

        total +=
        Number(
          doc.data().valor
        );
      });

      return bot.sendMessage(
        q.message.chat.id,

`📊 DASHBOARD

👥 Usuários:
${users.size}

📦 Produtos:
${produtos.size}

💰 Faturamento:
R$ ${total}

🛒 Vendas:
${vendas.size}`
      );
    }

    // =====================================
    // CATEGORIAS
    // =====================================

    if (
      data.startsWith(
        "cat_"
      )
    ) {

      const categoria =
      data.replace(
        "cat_",
        ""
      );

      const snap =
      await db
      .collection('produtos')
      .where(
        "categoria",
        "==",
        categoria
      )
      .get();

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

`📂 ${categoria}`,

{
  reply_markup: {
    inline_keyboard:
    buttons
  }
}
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

      if (!doc.exists)
        return;

      const p =
      doc.data();

      // VIDEO

      if (p.video) {

        return bot.sendVideo(
          q.message.chat.id,
          p.video,
{
  caption:

`📦 ${p.nome}

💰 R$ ${p.preco}

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

      // FOTO

      return bot.sendPhoto(
        q.message.chat.id,
        p.img,
{
  caption:

`📦 ${p.nome}

💰 R$ ${p.preco}

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

      if (!doc.exists)
        return;

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

      // PIX

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
          ).toISOString(),

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

        userId,

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

      return bot.sendPhoto(
        q.message.chat.id,

        Buffer.from(
          qr,
          'base64'
        ),

{
  caption:

`💰 PAGAMENTO PIX

📦 ${p.nome}

💲 R$ ${p.preco}

⏰ Expira em 5 minutos

📋 PIX COPIA E COLA:

${copia}`
}
      );
    }

    // =====================================
    // ADD PRODUTO
    // =====================================

    if (
      data ===
      "admin_add"
    ) {

      userState[userId] = {
        step: "categoria"
      };

      return bot.sendMessage(
        q.message.chat.id,
        "📂 Categoria:"
      );
    }

  } catch (err) {

    console.log(err);
  }
});

// =========================================
// CADASTRAR PRODUTO
// =========================================

bot.on(
'message',
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

    if (!state)
      return;

    if (
      state.step ===
      "categoria"
    ) {

      state.categoria =
      text;

      await db
      .collection('categorias')
      .doc(text)
      .set({
        nome: text
      });

      state.step =
      "imagem";

      return bot.sendMessage(
        msg.chat.id,
        "🖼 Link imagem:"
      );
    }

    if (
      state.step ===
      "imagem"
    ) {

      state.img =
      text;

      state.step =
      "video";

      return bot.sendMessage(
        msg.chat.id,
        "🎥 Link vídeo ou 'nao'"
      );
    }

    if (
      state.step ===
      "video"
    ) {

      state.video =
      text !== "nao"
      ? text
      : null;

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
      "whatsapp";

      return bot.sendMessage(
        msg.chat.id,
        "📲 WhatsApp:"
      );
    }

    if (
      state.step ===
      "whatsapp"
    ) {

      state.whatsapp =
      text;

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

        categoria:
        state.categoria,

        nome:
        state.nome,

        preco:
        state.preco,

        desc:
        state.desc,

        estoque:
        state.estoque,

        whatsapp:
        state.whatsapp,

        img:
        state.img,

        video:
        state.video,

        link:
        text,

        vendidos: 0,

        createdAt:
        Date.now()
      });

      userState[id] =
      null;

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
