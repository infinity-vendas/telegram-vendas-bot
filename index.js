// =========================================
// SELLFORGE BOT V3
// CATEGORIAS + PRODUTOS + PIX + STATS
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

const LOGO =
"https://i.postimg.cc/g2JJvqHN/logo.jpg";

// =========================================
// SISTEMA
// =========================================

const userState = {};
const userCooldown = {};
const userDaily = {};
const pixPending = {};
const categoryCooldown = {};

// =========================================
// LIMITES
// =========================================

const COMMAND_LIMIT = 80;
const PIX_LIMIT = 7;

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
      pix: 0
    };
  }

  if (
    userDaily[userId].date !== today
  ) {

    userDaily[userId] = {

      date: today,

      commands: 0,
      pix: 0
    };
  }
}

function isAdmin(userId) {

  return (
    userId === MASTER ||
    ADMINS.includes(userId)
  );
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
// REGISTRAR USER
// =========================================

async function registrarUsuario(user) {

  try {

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

        createdAt:
        Date.now(),

        ultimoDia:
        getToday()
      });

      return;
    }

    await ref.update({

      ultimoDia:
      getToday()
    });

  } catch (err) {

    console.log(err);
  }
}

// =========================================
// ADMIN
// =========================================

bot.onText(
/\/staff_dono/,
async (msg) => {

  const userId =
  String(msg.from.id);

  if (!isAdmin(userId))
    return;

  await bot.sendMessage(
    msg.chat.id,

`🔐 PAINEL ADMIN V3`,

{
  reply_markup: {
    inline_keyboard: [

      [
        {
          text:
          "📂 CRIAR CATEGORIA",

          callback_data:
          "admin_categoria"
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
          "📂 LISTAR CATEGORIAS",

          callback_data:
          "admin_categorias"
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
          "❌ DELETAR ID",

          callback_data:
          "admin_delete"
        }
      ],

      [
        {
          text:
          "📊 STATS",

          callback_data:
          "admin_stats"
        }
      ]
    ]
  }
}
  );
});

// =========================================
// START
// =========================================

bot.onText(
/\/start/,
async (msg) => {

  await registrarUsuario(
    msg.from
  );

  await bot.sendPhoto(
    msg.chat.id,
    LOGO,

{
  caption:

`🚀 BEM-VINDO

✅ PIX automático
✅ Entrega automática
✅ Categorias inteligentes`
}
  );

  await bot.sendMessage(
    msg.chat.id,

`📋 MENU`,

{
  reply_markup: {

    keyboard: [

      [
        "📂 CATEGORIAS"
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

    const admin =
    isAdmin(id);

    initUser(id);

    if (
      !admin &&
      userCooldown[id]
    ) return;

    if (!admin) {

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
          "⚠️ Limite diário atingido"
        );
      }
    }

    const text =
    msg.text;

    // =====================================
    // CATEGORIAS
    // =====================================

    if (
      text === "📂 CATEGORIAS"
    ) {

      if (!admin) {

        if (
          categoryCooldown[id]
        ) {

          return bot.sendMessage(
            msg.chat.id,

`⚠️ Aguarde 1 hora para abrir categorias novamente`
          );
        }

        categoryCooldown[id] = true;

        setTimeout(() => {

          delete categoryCooldown[id];

        }, 3600000);
      }

      const snap =
      await db
      .collection('categorias')
      .get();

      if (snap.empty) {

        return bot.sendMessage(
          msg.chat.id,
          "❌ Nenhuma categoria"
        );
      }

      const buttons = [];

      snap.forEach(doc => {

        const c =
        doc.data();

        buttons.push([{

          text:
          `📂 ${c.nome}`,

          callback_data:
          `cat_${doc.id}`
        }]);
      });

      return bot.sendMessage(
        msg.chat.id,

`📂 CATEGORIAS DISPONÍVEIS`,

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

    // =====================================
    // SISTEMA ADMIN
    // =====================================

    const state =
    userState[id];

    if (!state)
      return;

    // CRIAR CATEGORIA

    if (
      state.step ===
      "categoria_nome"
    ) {

      await db
      .collection('categorias')
      .add({

        nome:
        text,

        createdAt:
        Date.now()
      });

      userState[id] = null;

      return bot.sendMessage(
        msg.chat.id,

`✅ Categoria criada`
      );
    }

    // DELETE ID

    if (
      state.step ===
      "delete_id"
    ) {

      const ref =
      db.collection('produtos')
      .doc(text);

      const doc =
      await ref.get();

      if (!doc.exists) {

        userState[id] = null;

        return bot.sendMessage(
          msg.chat.id,
          "❌ Produto não encontrado"
        );
      }

      await ref.delete();

      userState[id] = null;

      return bot.sendMessage(
        msg.chat.id,
        "✅ Produto deletado"
      );
    }

    // ADD PRODUTO

    if (
      state.step ===
      "imagem"
    ) {

      state.img = text;

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

      state.nome = text;

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
      Number(text);

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

      state.desc = text;

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
        "🔗 Link:"
      );
    }

    if (
      state.step ===
      "link"
    ) {

      await db
      .collection('produtos')
      .add({

        categoriaId:
        state.categoriaId,

        categoriaNome:
        state.categoriaNome,

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

        whatsapp:
        state.whatsapp,

        link:
        text,

        createdAt:
        Date.now()
      });

      userState[id] = null;

      return bot.sendMessage(
        msg.chat.id,

`✅ PRODUTO ADICIONADO`
      );
    }

  } catch (err) {

    console.log(err);
  }
});

// =========================================
// CALLBACK QUERY
// =========================================

bot.on(
"callback_query",
async (q) => {

  try {

    await bot.answerCallbackQuery(
      q.id
    );

    const userId =
    String(q.from.id);

    const data =
    q.data;

    // =====================================
    // ADMIN CRIAR CATEGORIA
    // =====================================

    if (
      data ===
      "admin_categoria"
    ) {

      userState[userId] = {

        step:
        "categoria_nome"
      };

      return bot.sendMessage(
        q.message.chat.id,
        "📂 Nome da categoria:"
      );
    }

    // =====================================
    // ADMIN ADD
    // =====================================

    if (
      data ===
      "admin_add"
    ) {

      const snap =
      await db
      .collection('categorias')
      .get();

      if (snap.empty) {

        return bot.sendMessage(
          q.message.chat.id,
          "❌ Nenhuma categoria criada"
        );
      }

      const buttons = [];

      snap.forEach(doc => {

        const c =
        doc.data();

        buttons.push([{

          text:
          `📂 ${c.nome}`,

          callback_data:
          `selectcat_${doc.id}`
        }]);
      });

      return bot.sendMessage(
        q.message.chat.id,

`📂 Escolha categoria`,

{
  reply_markup: {
    inline_keyboard:
    buttons
  }
}
      );
    }

    // =====================================
    // SELECT CATEGORY ADMIN
    // =====================================

    if (
      data.startsWith(
        "selectcat_"
      )
    ) {

      const idCategoria =
      data.replace(
        "selectcat_",
        ""
      );

      const doc =
      await db
      .collection('categorias')
      .doc(idCategoria)
      .get();

      if (!doc.exists)
        return;

      const c =
      doc.data();

      userState[userId] = {

        step:
        "imagem",

        categoriaId:
        idCategoria,

        categoriaNome:
        c.nome
      };

      return bot.sendMessage(
        q.message.chat.id,
        "🖼 Link imagem:"
      );
    }

    // =====================================
    // CLIENT CATEGORY
    // =====================================

    if (
      data.startsWith(
        "cat_"
      )
    ) {

      const idCategoria =
      data.replace(
        "cat_",
        ""
      );

      const snap =
      await db
      .collection('produtos')
      .where(
        "categoriaId",
        "==",
        idCategoria
      )
      .get();

      if (snap.empty) {

        return bot.sendMessage(
          q.message.chat.id,
          "❌ Nenhum produto"
        );
      }

      for (
        const item
        of snap.docs
      ) {

        const p =
        item.data();

        await bot.sendPhoto(
          q.message.chat.id,
          p.img,

{
  caption:

`📦 ${p.nome}

💰 R$ ${p.preco}

📦 Estoque:
${p.estoque}

📝 ${p.desc}`,

  reply_markup: {
    inline_keyboard: [[{

      text:
      "🛒 COMPRAR",

      callback_data:
      `buy_${item.id}`

    }]]
  }
}
        );
      }

      return;
    }

    // =====================================
    // BUY
    // =====================================

    if (
      data.startsWith(
        "buy_"
      )
    ) {

      if (
        pixPending[userId]
      ) {

        return bot.sendMessage(
          q.message.chat.id,
          "⚠️ PIX pendente"
        );
      }

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

      pixPending[userId] = true;

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

        userId:
        userId,

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

📦 ${p.nome}

💲 R$ ${p.preco}

📋 PIX COPIA E COLA:

${copia}

⏳ Aguardando pagamento`
}
      );
    }

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

      aprovado: true
    });

    const produtoRef =
    db.collection('produtos')
    .doc(info.produtoId);

    const produtoDoc =
    await produtoRef.get();

    let estoqueRestante = 0;

    if (produtoDoc.exists) {

      estoqueRestante =
      (produtoDoc.data().estoque || 0) - 1;

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

`✅ PAGAMENTO APROVADO

📦 ${info.produto}

🔓 LINK:
${info.link}`
    );

    res.sendStatus(200);

  } catch (err) {

    console.log(err);

    res.sendStatus(500);
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
