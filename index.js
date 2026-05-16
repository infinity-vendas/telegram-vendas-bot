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
    "🚀 SELLFORGE V3 ONLINE"
  );
});

// =========================================
// LISTAR CATEGORIAS
// =========================================

async function getCategoriasButtons() {

  const snap =
  await db
  .collection('categorias')
  .get();

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

  return buttons;
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
    // COMPRA DIÁRIA
    // =====================================

    const hoje =
    new Date()
    .toISOString()
    .slice(0, 10);

    await db
    .collection('compras_diarias')
    .doc(
`${info.chatId}_${hoje}`
    )
    .set({

      createdAt:
      Date.now()
    });

    // =====================================
    // ESTOQUE
    // =====================================

    const produtoSnap =
    await db
    .collection('produtos')
    .where(
      "nome",
      "==",
      info.produto
    )
    .get();

    if (
      !produtoSnap.empty
    ) {

      const produtoDoc =
      produtoSnap.docs[0];

      const produto =
      produtoDoc.data();

      const novoEstoque =
      Number(
        produto.estoque || 0
      ) - 1;

      await db
      .collection('produtos')
      .doc(produtoDoc.id)
      .update({

        estoque:
        novoEstoque
      });
    }

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

📲 WhatsApp:
${info.whatsapp}

━━━━━━━━━━━━━━━━━━━

🔓 LINK LIBERADO:

${info.link}

━━━━━━━━━━━━━━━━━━━

🚀 Obrigado pela compra!`
    );

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

  try {

    const chatId =
    msg.chat.id;

    await bot.sendPhoto(
      chatId,
      LOGO,

{
  caption:

`🚀 Bem-vindo(a)!

━━━━━━━━━━━━━━━━━━━

✅ PIX automático
✅ Entrega automática
✅ Marketplace profissional
✅ Categorias
✅ Estoque automático

━━━━━━━━━━━━━━━━━━━

💙 SELLFORGE V3`
}
    );

    await bot.sendMessage(
      chatId,

`💙 MENU SELLFORGE`,

{
  reply_markup: {

    keyboard: [

      ["📦 PRODUTOS"],

      ["ℹ️ INFORMAÇÕES"],

      ["📲 SUPORTE"]

    ],

    resize_keyboard: true,

    persistent: true
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
/\/admin_sellforge/,
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

`🔐 PAINEL ADMIN SELLFORGE`,

{
  reply_markup: {
    inline_keyboard: [

      [{
        text:
        "📂 CRIAR CATEGORIA",

        callback_data:
        "admin_categoria"
      }],

      [{
        text:
        "➕ ADD PRODUTO",

        callback_data:
        "admin_add"
      }],

      [{
        text:
        "📦 LISTAR",

        callback_data:
        "admin_listar"
      }],

      [{
        text:
        "🗑 PRODUTO ID",

        callback_data:
        "admin_delete_prod"
      }],

      [{
        text:
        "🗑 CATEGORIA",

        callback_data:
        "admin_delete_cat"
      }],

      [{
        text:
        "🗑 LIMPAR",

        callback_data:
        "admin_limpar"
      }]
    ]
  }
}
    );

  } catch (err) {

    console.log(err);
  }
});

// =========================================
// MENU KEYBOARD
// =========================================

bot.on(
"message",
async (msg) => {

  try {

    if (!msg.text)
      return;

    const text =
    msg.text;

    const chatId =
    msg.chat.id;

    // =====================================
    // PRODUTOS
    // =====================================

    if (
      text === "📦 PRODUTOS"
    ) {

      const buttons =
      await getCategoriasButtons();

      if (
        buttons.length <= 0
      ) {

        return bot.sendMessage(
          chatId,
          "❌ Nenhuma categoria"
        );
      }

      return bot.sendMessage(
        chatId,

`📂 CATEGORIAS`,

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
        chatId,

`🚀 SELLFORGE V3

✅ PIX automático
✅ Entrega automática
✅ Marketplace profissional
✅ Sistema premium`
      );
    }

    // =====================================
    // SUPORTE
    // =====================================

    if (
      text === "📲 SUPORTE"
    ) {

      return bot.sendMessage(
        chatId,

`📲 SUPORTE

https://wa.me/${WHATSAPP}`
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
    // CATEGORIAS
    // =====================================

    if (
      data.startsWith("cat_")
    ) {

      const categoriaId =
      data.replace(
        "cat_",
        ""
      );

      // ADMIN

      if (
        userState[userId] &&
        userState[userId].step ===
        "selecionando_categoria"
      ) {

        userState[userId] = {

          categoriaId,

          step:
          "imagem"
        };

        return bot.sendMessage(
          q.message.chat.id,

`🖼 ENVIE LINK DA IMAGEM`
        );
      }

      // CLIENTE

      const snap =
      await db
      .collection('produtos')
      .where(
        "categoriaId",
        "==",
        categoriaId
      )
      .get();

      if (
        snap.empty
      ) {

        return bot.sendMessage(
          q.message.chat.id,
          "❌ Nenhum produto"
        );
      }

      for (
        const doc
        of snap.docs
      ) {

        const p =
        doc.data();

        if (
          p.estoque <= 0
        ) continue;

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
      `buy_${doc.id}`

    }]]
  }
}
        );
      }

      return;
    }

    // =====================================
    // ADMIN CATEGORIA
    // =====================================

    if (
      data === "admin_categoria"
    ) {

      userState[userId] = {
        step:
        "criar_categoria"
      };

      return bot.sendMessage(
        q.message.chat.id,

`📂 Nome categoria`
      );
    }

    // =====================================
    // ADMIN ADD
    // =====================================

    if (
      data === "admin_add"
    ) {

      const buttons =
      await getCategoriasButtons();

      if (
        buttons.length <= 0
      ) {

        return bot.sendMessage(
          q.message.chat.id,

`❌ Crie categoria primeiro`
        );
      }

      userState[userId] = {
        step:
        "selecionando_categoria"
      };

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
    // LISTAR
    // =====================================

    if (
      data === "admin_listar"
    ) {

      const snap =
      await db
      .collection('produtos')
      .get();

      if (
        snap.empty
      ) {

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
📦 Estoque: ${p.estoque}

`;
      });

      return bot.sendMessage(
        q.message.chat.id,
        texto
      );
    }

    // =====================================
    // DELETE PRODUTO
    // =====================================

    if (
      data ===
      "admin_delete_prod"
    ) {

      userState[userId] = {
        step:
        "deletar_produto"
      };

      return bot.sendMessage(
        q.message.chat.id,

`🗑 Envie ID produto`
      );
    }

    // =====================================
    // DELETE CATEGORIA
    // =====================================

    if (
      data ===
      "admin_delete_cat"
    ) {

      userState[userId] = {
        step:
        "delete_categoria"
      };

      return bot.sendMessage(
        q.message.chat.id,

`🗑 Nome categoria`
      );
    }

    // =====================================
    // LIMPAR
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

`🗑 Produtos deletados`
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

      const hoje =
      new Date()
      .toISOString()
      .slice(0, 10);

      const compraHoje =
      await db
      .collection('compras_diarias')
      .doc(
`${userId}_${hoje}`
      )
      .get();

      if (
        compraHoje.exists
      ) {

        return bot.sendMessage(
          q.message.chat.id,

`💙 Caro cliente,

Por motivos de segurança de nosso Bot compre apenas 1 produto por dia.

Retorne amanhã...`
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

      if (
        p.estoque <= 0
      ) {

        return bot.sendMessage(
          q.message.chat.id,
          "❌ Sem estoque"
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

      await bot.sendPhoto(
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

━━━━━━━━━━━━━━━━━━━

${copia}

━━━━━━━━━━━━━━━━━━━

⏳ Aguardando pagamento`
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
// STATES
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
    // CRIAR CATEGORIA
    // =====================================

    if (
      state.step ===
      "criar_categoria"
    ) {

      await db
      .collection('categorias')
      .add({

        nome:
        text,

        createdAt:
        Date.now()
      });

      userState[id] =
      null;

      return bot.sendMessage(
        msg.chat.id,

`✅ Categoria criada`
      );
    }

    // =====================================
    // DELETE PRODUTO
    // =====================================

    if (
      state.step ===
      "deletar_produto"
    ) {

      await db
      .collection('produtos')
      .doc(text)
      .delete();

      userState[id] =
      null;

      return bot.sendMessage(
        msg.chat.id,

`✅ Produto deletado`
      );
    }

    // =====================================
    // DELETE CATEGORIA
    // =====================================

    if (
      state.step ===
      "delete_categoria"
    ) {

      const snap =
      await db
      .collection('categorias')
      .where(
        "nome",
        "==",
        text
      )
      .get();

      for (
        const doc
        of snap.docs
      ) {

        await db
        .collection('categorias')
        .doc(doc.id)
        .delete();
      }

      userState[id] =
      null;

      return bot.sendMessage(
        msg.chat.id,

`✅ Categoria deletada`
      );
    }

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
        "📦 Quantidade estoque:"
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
    // LINK
    // =====================================

    if (
      state.step ===
      "link"
    ) {

      await db
      .collection('produtos')
      .add({

        categoriaId:
        state.categoriaId,

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

  console.log(
    webhook
  );
}
);
