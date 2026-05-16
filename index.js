// =========================================
// SELLFORGE BOT V2
// CATEGORIAS + COOLDOWN 1H
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

const MASTER = "6863505946";

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

const CATEGORY_COOLDOWN =
1000 * 60 * 60; // 1 hora

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

  res.send("🚀 BOT ONLINE");
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

  if (
    userId !== MASTER &&
    !ADMINS.includes(userId)
  ) return;

  await bot.sendMessage(
    msg.chat.id,

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
      ]
    ]
  }
}
  );
});

// =========================================
// STATS
// =========================================

bot.onText(
/\/stats/,
async (msg) => {

  const userId =
  String(msg.from.id);

  if (
    userId !== MASTER &&
    !ADMINS.includes(userId)
  ) return;

  const usuarios =
  await db.collection(
    'usuarios'
  ).get();

  const produtos =
  await db.collection(
    'produtos'
  ).get();

  const pagamentos =
  await db.collection(
    'pagamentos'
  ).get();

  await bot.sendMessage(
    msg.chat.id,

`📊 ESTATÍSTICAS

👥 Usuários:
${usuarios.size}

📦 Produtos:
${produtos.size}

💰 Pagamentos:
${pagamentos.size}

⚡ Limite comandos:
${COMMAND_LIMIT}`
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

      aprovado: true
    });

    const produtoRef =
    db.collection('produtos')
    .doc(info.produtoId);

    const produtoDoc =
    await produtoRef.get();

    if (produtoDoc.exists) {

      let estoque =
      produtoDoc.data().estoque || 0;

      estoque--;

      if (estoque < 0)
        estoque = 0;

      await produtoRef.update({

        estoque
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
✅ Entrega automática`
}
  );

  await bot.sendMessage(
    msg.chat.id,

`📋 MENU`,

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

    if (
      userCooldown[id]
    ) return;

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
        "⚠️ Limite diário"
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

      const ultimo =
      categoryCooldown[id];

      if (
        ultimo &&
        Date.now() - ultimo <
        CATEGORY_COOLDOWN
      ) {

        return bot.sendMessage(
          msg.chat.id,

`⚠️ Você já visualizou produtos recentemente.

⏳ Aguarde 1 hora.`
        );
      }

      return bot.sendMessage(
        msg.chat.id,

`📂 ESCOLHA CATEGORIA`,

{
  reply_markup: {

    inline_keyboard: [

      [
        {
          text:
          "🎮 FREE FIRE",

          callback_data:
          "cat_FREE FIRE"
        }
      ],

      [
        {
          text:
          "💎 VIP",

          callback_data:
          "cat_VIP"
        }
      ],

      [
        {
          text:
          "📱 CONTAS",

          callback_data:
          "cat_CONTAS"
        }
      ],

      [
        {
          text:
          "🛠 FERRAMENTAS",

          callback_data:
          "cat_FERRAMENTAS"
        }
      ]
    ]
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
        "🚀 Sistema online"
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
    // ADD PRODUTO
    // =====================================

    const state =
    userState[id];

    if (!state)
      return;

    if (
      state.step === "imagem"
    ) {

      state.img = text;

      state.step = "produto";

      return bot.sendMessage(
        msg.chat.id,
        "📦 Nome produto:"
      );
    }

    if (
      state.step === "produto"
    ) {

      state.nome = text;

      state.step = "valor";

      return bot.sendMessage(
        msg.chat.id,
        "💰 Valor:"
      );
    }

    if (
      state.step === "valor"
    ) {

      state.preco =
      Number(text);

      state.step = "descricao";

      return bot.sendMessage(
        msg.chat.id,
        "📝 Descrição:"
      );
    }

    if (
      state.step === "descricao"
    ) {

      state.desc = text;

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

      state.step = "whatsapp";

      return bot.sendMessage(
        msg.chat.id,
        "📲 WhatsApp:"
      );
    }

    if (
      state.step === "whatsapp"
    ) {

      state.whatsapp = text;

      state.step = "link";

      return bot.sendMessage(
        msg.chat.id,
        "🔗 Link:"
      );
    }

    if (
      state.step === "link"
    ) {

      state.link = text;

      state.step = "categoria";

      return bot.sendMessage(
        msg.chat.id,

`📂 Categoria:

FREE FIRE
VIP
CONTAS
FERRAMENTAS`
      );
    }

    if (
      state.step === "categoria"
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

        whatsapp:
        state.whatsapp,

        link:
        state.link,

        categoria:
        text.toUpperCase(),

        createdAt:
        Date.now()
      });

      userState[id] = null;

      return bot.sendMessage(
        msg.chat.id,
        "✅ PRODUTO ADICIONADO"
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
    // ADMIN ADD
    // =====================================

    if (
      data === "admin_add"
    ) {

      userState[userId] = {

        step: "imagem"
      };

      return bot.sendMessage(
        q.message.chat.id,
        "🖼 Link imagem:"
      );
    }

    // =====================================
    // LISTAR
    // =====================================

    if (
      data === "admin_listar"
    ) {

      const snap =
      await db
      .collection('produtos')
      .limit(30)
      .get();

      let txt =
      "📦 PRODUTOS\n\n";

      snap.forEach(doc => {

        const p =
        doc.data();

        txt +=
`🆔 ${doc.id}
📦 ${p.nome}
📂 ${p.categoria}

`;
      });

      return bot.sendMessage(
        q.message.chat.id,
        txt
      );
    }

    // =====================================
    // CATEGORIAS
    // =====================================

    if (
      data.startsWith("cat_")
    ) {

      categoryCooldown[userId] =
      Date.now();

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
      .limit(10)
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
    // COMPRAR
    // =====================================

    if (
      data.startsWith("buy_")
    ) {

      if (
        pixPending[userId]
      ) {

        return bot.sendMessage(
          q.message.chat.id,
          "⚠️ PIX pendente"
        );
      }

      pixPending[userId] = true;

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

        delete pixPending[userId];

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

⏳ Aguardando pagamento...`
}
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
