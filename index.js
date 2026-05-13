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

const spamControl = {};
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
// SISTEMA SPAM
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

  setTimeout(() => {

    if (spamControl[userId]) {
      spamControl[userId].count--;
    }

  }, 5000);

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

      const novoEstoque =
      (produto.estoque || 0) - 1;

      if (
        novoEstoque <= 0
      ) {

        await produtoRef.delete();

      } else {

        await produtoRef.update({

          estoque:
          novoEstoque,

          vendas:
          FieldValue.increment(1)
        });
      }
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

━━━━━━━━━━━━━━━━━━━

🔓 LINK:
${info.link}

📲 WhatsApp:
${info.whatsapp}

━━━━━━━━━━━━━━━━━━━

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

    const userId =
    String(msg.from.id);

    if (
      isBlocked(userId)
    ) {

      return bot.sendMessage(
        chatId,

`⛔ Seus comandos estão bloqueados temporariamente.

⏳ Aguarde 1 minuto.`
      );
    }

    await bot.sendPhoto(
      chatId,
      LOGO,
{
  caption:

`🚀 BEM-VINDO AO SELLFORGE ⚡

✅ PIX automático
✅ Aprovação automática
✅ Entrega instantânea
✅ Produtos VIP
✅ Sistema inteligente
✅ Segurança anti-spam

👑 Desenvolvido por Faelzin

📲 Suporte:
${SUPPORT}`
}
    );

    await bot.sendMessage(
      chatId,

`🚀 SELLFORGE MARKETPLACE

━━━━━━━━━━━━━━━━━━━

⚡ Plataforma automática Telegram.

✅ Produtos digitais
✅ PIX automático
✅ Entrega instantânea
✅ Estoque automático
✅ Painel ADMIN secreto
✅ Sistema anti-flood

━━━━━━━━━━━━━━━━━━━

👇 Escolha abaixo:`,

{
  reply_markup: {
    inline_keyboard: [

      [
        {
          text:
          "📦 PRODUTOS",

          callback_data:
          "menu_produtos"
        },

        {
          text:
          "🛒 COMPRAS",

          callback_data:
          "menu_compras"
        }
      ],

      [
        {
          text:
          "📡 STATUS",

          callback_data:
          "menu_status"
        },

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

  } catch (err) {

    console.log(
      "❌ START ERROR:",
      err
    );
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

    if (
      !spamControl[userId]
    ) {

      spamControl[userId] = {
        adminTry: 1
      };

      return bot.sendMessage(
        msg.chat.id,

`❌ 1/2 não têm autorização!

⚠️ Mais uma tentativa
e seus acessos serão bloqueados.`
      );
    }

    spamControl[userId].adminTry =
    (spamControl[userId].adminTry || 1) + 1;

    if (
      spamControl[userId].adminTry >= 2
    ) {

      blockedUsers[userId] =
      Date.now() + 60000;

      return bot.sendMessage(
        msg.chat.id,

`⛔ Seus comandos foram bloqueados por 1 minuto.`
      );
    }

    return;
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
// CALLBACK
// =========================================

bot.on(
"callback_query",
async (q) => {

  try {

    const data =
    q.data;

    const userId =
    String(q.from.id);

    if (
      isBlocked(userId)
    ) {

      return bot.answerCallbackQuery(
        q.id,
{
  text:
  "⛔ Bloqueado temporariamente"
}
      );
    }

    if (
      addSpam(userId)
    ) {

      return bot.sendMessage(
        q.message.chat.id,

`⚠️ Evite spam.

Caso continue mandando em massa,
seus comandos serão bloqueados temporariamente.`
      );
    }

    await bot.answerCallbackQuery(
      q.id
    );

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
    // COMPRAS
    // =====================================

    if (
      data === "menu_compras"
    ) {

      return bot.sendMessage(
        q.message.chat.id,

`🛒 Histórico disponível em breve.`
      );
    }

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
          "❌ Nenhum produto disponível"
        );
      }

      const buttons = [];

      snap.forEach(doc => {

        const p =
        doc.data();

        buttons.push([
          {
            text:
`${p.nome} | R$ ${p.preco} | Estoque: ${p.estoque}`,

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

📦 Estoque:
${p.estoque || 0}

📝 ${p.desc}

⚠️ Compre somente
com administrador oficial.`,

  reply_markup: {
    inline_keyboard: [

      [
        {
          text:
          "🛒 COMPRAR",

          callback_data:
          `buy_${doc.id}`
        }
      ],

      [
        {
          text:
          "❌ CANCELAR",

          callback_data:
          "cancel_buy"
        }
      ]
    ]
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
        "❌ Compra cancelada."
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
        (p.estoque || 0) <= 0
      ) {

        await db
        .collection('produtos')
        .doc(idProduto)
        .delete();

        return bot.sendMessage(
          q.message.chat.id,
          "❌ Produto sem estoque."
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

        produtoId:
        idProduto,

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

`💳 PAGAMENTO PIX

📦 ${p.nome}

💰 R$ ${p.preco}

📲 PIX COPIA E COLA:

${copia}

⏳ Aguardando pagamento automático.`
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
        userId !== MASTER
      ) return;

      userState[userId] = {
        step: "imagem"
      };

      return bot.sendMessage(
        q.message.chat.id,
        "🖼 Envie link da imagem:"
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
💰 R$ ${p.preco}
📦 Estoque: ${p.estoque}

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

      if (
        userId !== MASTER
      ) return;

      const produtos =
      await db
      .collection('produtos')
      .get();

      const historico =
      await db
      .collection('historico')
      .get();

      return bot.sendMessage(
        q.message.chat.id,

`📈 DASHBOARD

📦 Produtos:
${produtos.size}

💸 Vendas:
${historico.size}`
      );
    }

    // =====================================
    // LIMPAR
    // =====================================

    if (
      data === "admin_limpar"
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
        "🗑 Todos produtos deletados"
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
// ADD PRODUTO
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
    // IMAGEM
    // =====================================

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

    // =====================================
    // PRODUTO
    // =====================================

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

    // =====================================
    // VALOR
    // =====================================

    if (
      state.step ===
      "valor"
    ) {

      state.preco =
      Number(
        text.replace(",", ".")
      );

      state.step =
      "estoque";

      return bot.sendMessage(
        msg.chat.id,
        "📦 Estoque:"
      );
    }

    // =====================================
    // ESTOQUE
    // =====================================

    if (
      state.step ===
      "estoque"
    ) {

      state.estoque =
      Number(text);

      state.step =
      "descricao";

      return bot.sendMessage(
        msg.chat.id,
        "📝 Descrição:"
      );
    }

    // =====================================
    // DESCRIÇÃO
    // =====================================

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
        "📲 WhatsApp:"
      );
    }

    // =====================================
    // WHATSAPP
    // =====================================

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

    // =====================================
    // LINK FINAL
    // =====================================

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

        estoque:
        state.estoque,

        desc:
        state.desc,

        img:
        state.img,

        whatsapp:
        state.whatsapp,

        link:
        text,

        vendas: 0,

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
📦 Estoque: ${state.estoque}`
      );
    }

  } catch (err) {

    console.log(
      "❌ MESSAGE ERROR:",
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
