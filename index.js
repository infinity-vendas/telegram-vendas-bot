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

const AUDIO =
"https://files.catbox.moe/p6wlxb.mp3";

const userState = {};

// =========================================
// PLANOS
// =========================================

const PLANOS = {

  d1: {
    nome: "1 DIA",
    valor: 0.97,
    dias: 1
  },

  d3: {
    nome: "3 DIAS",
    valor: 5.00,
    dias: 3
  },

  d7: {
    nome: "7 DIAS",
    valor: 10.00,
    dias: 7
  },

  d14: {
    nome: "14 DIAS",
    valor: 15.00,
    dias: 14
  },

  d21: {
    nome: "21 DIAS",
    valor: 20.00,
    dias: 21
  },

  d30: {
    nome: "30 DIAS",
    valor: 25.00,
    dias: 30
  }
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
// VERIFICAR PLANO
// =========================================

async function possuiPlano(userId){

  const doc =
  await db
  .collection("vendedores")
  .doc(userId)
  .get();

  if (!doc.exists)
    return false;

  const data =
  doc.data();

  if (!data.expiraEm)
    return false;

  return Date.now() <
  data.expiraEm;
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
    // PLANO VENDEDOR
    // =====================================

    if (
      info.tipo === "plano"
    ) {

      const plano =
      PLANOS[info.plano];

      const expiraEm =
      Date.now() +
      (
        plano.dias *
        24 *
        60 *
        60 *
        1000
      );

      await db
      .collection("vendedores")
      .doc(info.userId)
      .set({

        nome:
        info.nome,

        loja:
        info.loja,

        expiraEm

      });

      const linkLoja =
`https://t.me/${BOT_USERNAME}?start=loja_${info.loja}`;

      await bot.sendMessage(
        info.chatId,

`✅ PLANO ATIVADO!

━━━━━━━━━━━━━━━━━━━

👤 Loja:
${info.loja}

📅 Plano:
${plano.nome}

🔗 LINK DA SUA LOJA:

${linkLoja}

━━━━━━━━━━━━━━━━━━━

🚀 Agora você já pode vender produtos`
      );

      return res.sendStatus(200);
    }

    // =====================================
    // ENTREGA PRODUTO
    // =====================================

    const produtoRef =
    db.collection('produtos')
    .doc(info.produtoId);

    const produtoDoc =
    await produtoRef.get();

    if (produtoDoc.exists) {

      const estoqueAtual =
      produtoDoc.data().estoque || 0;

      if (estoqueAtual > 0) {

        await produtoRef.update({

          estoque:
          estoqueAtual - 1
        });
      }
    }

    await bot.sendMessage(
      info.chatId,

`✅ PAGAMENTO APROVADO!

━━━━━━━━━━━━━━━━━━━

📦 Produto:
${info.produto}

💰 Valor:
R$ ${info.valor}

📦 Estoque restante:
${Math.max((produtoDoc.data().estoque || 1) - 1, 0)}

━━━━━━━━━━━━━━━━━━━

📲 Contato vendedor:

${info.whatsapp}

💳 PIX vendedor:

${info.pix}

━━━━━━━━━━━━━━━━━━━

🔓 LINK LIBERADO:

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
/\/start(?: (.+))?/,
async (msg, match) => {

  try {

    const chatId =
    msg.chat.id;

    const userId =
    String(msg.from.id);

    const param =
    match[1];

    // =====================================
    // LOJA VENDEDOR
    // =====================================

    if (
      param &&
      param.startsWith(
        "loja_"
      )
    ) {

      const loja =
      param.replace(
        "loja_",
        ""
      );

      const snap =
      await db
      .collection('produtos')
      .where(
        "loja",
        "==",
        loja
      )
      .get();

      if (snap.empty) {

        return bot.sendMessage(
          chatId,
          "❌ Loja vazia"
        );
      }

      const buttons = [];

      snap.forEach(doc => {

        const p =
        doc.data();

        if (p.estoque > 0) {

          buttons.push([
            {
              text:
`${p.nome} | R$ ${p.preco}`,

              callback_data:
`view_${doc.id}`
            }
          ]);
        }
      });

      return bot.sendMessage(
        chatId,

`🛒 LOJA ${loja}

Selecione um produto abaixo 👇`,

{
  reply_markup: {
    inline_keyboard:
    buttons
  }
}
      );
    }

    // =====================================
    // AUDIO
    // =====================================

    await bot.sendAudio(
      chatId,
      AUDIO,
{
  caption:
"🎧 Bem-vindo(a)"
}
    );

    // =====================================
    // FOTO
    // =====================================

    await bot.sendPhoto(
      chatId,
      LOGO,
{
  caption:

`🚀 Olá 👋 seja bem-vindo(a)!

Você está na
INFINITY CLIENTES

━━━━━━━━━━━━━━━━━━━

✅ Produtos digitais
✅ PIX automático
✅ Aprovação automática
✅ Entrega automática
✅ Sistema de estoque
✅ Aluguel de Bot
✅ Suporte rápido

━━━━━━━━━━━━━━━━━━━

⚠️ Não caia em golpes.
Compre apenas pelo canal oficial.

━━━━━━━━━━━━━━━━━━━

💳 Pagamento seguro
via Mercado Pago

👇 Escolha uma opção abaixo`
}
    );

    // =====================================
    // MENU INLINE_KEYBOARD
    // =====================================

    await bot.sendMessage(
      chatId,

`📋 MENU PRINCIPAL`,

{
  reply_markup: {
    inline_keyboard: [

      [
        {
          text:
          "📦 PRODUTOS",

          callback_data:
          "menu_produtos"
        }
      ],

      [
        {
          text:
          "💎 ALUGAR BOT",

          callback_data:
          "menu_planos"
        }
      ],

      [
        {
          text:
          "ℹ️ INFORMAÇÕES",

          callback_data:
          "menu_info"
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

    // =====================================
    // MOSTRAR STATUS
    // =====================================

    const ativo =
    await possuiPlano(
      userId
    );

    if (ativo) {

      const vendedorDoc =
      await db
      .collection("vendedores")
      .doc(userId)
      .get();

      const vendedor =
      vendedorDoc.data();

      const lojaLink =
`https://t.me/${BOT_USERNAME}?start=loja_${vendedor.loja}`;

      await bot.sendMessage(
        chatId,

`✅ SEU PLANO ESTÁ ATIVO

━━━━━━━━━━━━━━━━━━━

👤 Loja:
${vendedor.loja}

🔗 Seu link:

${lojaLink}

━━━━━━━━━━━━━━━━━━━

📦 Comandos:

/produtos
/minhaloja
/renovar
/cancelar

━━━━━━━━━━━━━━━━━━━

🚀 Sua loja está online`
      );

    } else {

      await bot.sendMessage(
        chatId,

`❌ Você não possui plano ativo

Use o botão 💎 ALUGAR BOT
para ativar sua loja`
      );
    }

  } catch (err) {

    console.log(err);
  }
});

// =========================================
// COMANDO PRODUTOS
// =========================================

bot.onText(
/\/produtos/,
async (msg) => {

  try {

    const userId =
    String(msg.from.id);

    const ativo =
    await possuiPlano(
      userId
    );

    if (!ativo) {

      return bot.sendMessage(
        msg.chat.id,

`❌ Seu plano expirou

Use /start para renovar`
      );
    }

    const vendedorDoc =
    await db
    .collection("vendedores")
    .doc(userId)
    .get();

    const vendedor =
    vendedorDoc.data();

    const snap =
    await db
    .collection("produtos")
    .where(
      "vendedorId",
      "==",
      userId
    )
    .get();

    if (snap.empty) {

      return bot.sendMessage(
        msg.chat.id,
        "❌ Você não possui produtos"
      );
    }

    let texto =
`📦 PRODUTOS DA LOJA ${vendedor.loja}

\n`;

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
      msg.chat.id,
      texto
    );

  } catch (err) {

    console.log(err);
  }
});

// =========================================
// MINHA LOJA
// =========================================

bot.onText(
/\/minhaloja/,
async (msg) => {

  try {

    const userId =
    String(msg.from.id);

    const ativo =
    await possuiPlano(
      userId
    );

    if (!ativo) {

      return bot.sendMessage(
        msg.chat.id,
        "❌ Plano expirado"
      );
    }

    const vendedorDoc =
    await db
    .collection("vendedores")
    .doc(userId)
    .get();

    const vendedor =
    vendedorDoc.data();

    const link =
`https://t.me/${BOT_USERNAME}?start=loja_${vendedor.loja}`;

    await bot.sendMessage(
      msg.chat.id,

`🔗 SUA LOJA

${link}`
    );

  } catch (err) {

    console.log(err);
  }
});

// =========================================
// RENOVAR
// =========================================

bot.onText(
/\/renovar/,
async (msg) => {

  return bot.sendMessage(
    msg.chat.id,
    "💎 Use /start e clique em ALUGAR BOT"
  );
});

// =========================================
// CANCELAR
// =========================================

bot.onText(
/\/cancelar/,
async (msg) => {

  const userId =
  String(msg.from.id);

  await db
  .collection("vendedores")
  .doc(userId)
  .delete();

  return bot.sendMessage(
    msg.chat.id,
    "❌ Seu plano foi cancelado"
  );
});

// =========================================
// PAINEL ADMIN
// =========================================

bot.onText(
/\/staff_dono/,
async (msg) => {

  try {

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
    // MENU INFO
    // =====================================

    if (
      data === "menu_info"
    ) {

      return bot.sendMessage(
        q.message.chat.id,

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
    // PLANOS
    // =====================================

    if (
      data === "menu_planos"
    ) {

      return bot.sendMessage(
        q.message.chat.id,

`💎 PLANOS DISPONÍVEIS

━━━━━━━━━━━━━━━━━━━

📅 1 DIA = R$ 0,97
📅 3 DIAS = R$ 5,00
📅 7 DIAS = R$ 10,00
📅 14 DIAS = R$ 15,00
📅 21 DIAS = R$ 20,00
📅 30 DIAS = R$ 25,00

━━━━━━━━━━━━━━━━━━━`

,
{
  reply_markup: {
    inline_keyboard: [

      [
        {
          text:
          "1 DIA",

          callback_data:
          "plano_d1"
        }
      ],

      [
        {
          text:
          "3 DIAS",

          callback_data:
          "plano_d3"
        },

        {
          text:
          "7 DIAS",

          callback_data:
          "plano_d7"
        }
      ],

      [
        {
          text:
          "14 DIAS",

          callback_data:
          "plano_d14"
        },

        {
          text:
          "21 DIAS",

          callback_data:
          "plano_d21"
        }
      ],

      [
        {
          text:
          "30 DIAS",

          callback_data:
          "plano_d30"
        }
      ]
    ]
  }
}
      );
    }

    // =====================================
    // GERAR PLANO
    // =====================================

    if (
      data.startsWith(
        "plano_"
      )
    ) {

      const planoId =
      data.replace(
        "plano_",
        ""
      );

      const plano =
      PLANOS[planoId];

      const payment =
      await mpPayment.create({

        body: {

          transaction_amount:
          Number(plano.valor),

          description:
          `Plano ${plano.nome}`,

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

      const loja =
`loja${q.from.id}`;

      await db
      .collection('pagamentos')
      .doc(
        String(payment.id)
      )
      .set({

        tipo:
        "plano",

        plano:
        planoId,

        userId:
        userId,

        nome:
        q.from.first_name,

        loja:
        loja,

        chatId:
        q.message.chat.id,

        aprovado:
        false
      });

      return bot.sendPhoto(
        q.message.chat.id,

        Buffer.from(
          qr,
          'base64'
        ),

{
  caption:

`💎 PAGAMENTO PLANO

━━━━━━━━━━━━━━━━━━━

📅 ${plano.nome}

💰 R$ ${plano.valor}

📋 PIX COPIA E COLA:

${copia}

━━━━━━━━━━━━━━━━━━━

⏳ Aguardando pagamento...`
}
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
          "❌ Nenhum produto cadastrado"
        );
      }

      const buttons = [];

      snap.forEach(doc => {

        const p =
        doc.data();

        if (p.estoque > 0) {

          buttons.push([
            {
              text:
`📦 ${p.nome} | R$ ${p.preco}`,

              callback_data:
`view_${doc.id}`
            }
          ]);
        }
      });

      return bot.sendMessage(
        q.message.chat.id,

`📦 LISTA DE PRODUTOS

Selecione um produto abaixo 👇`,

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

      if (
        p.estoque <= 0
      ) {

        return bot.sendMessage(
          q.message.chat.id,
          "❌ Produto sem estoque"
        );
      }

      return bot.sendPhoto(
        q.message.chat.id,
        p.img,

{
  caption:

`📦 ${p.nome}

💰 Valor:
R$ ${p.preco}

📦 Estoque:
${p.estoque}

📝 Descrição:
${p.desc}`,

  reply_markup: {
    inline_keyboard: [

      [
        {
          text:
          "🛒 COMPRAR AGORA",

          callback_data:
          `buy_${doc.id}`
        }
      ]
    ]
  }
}
      );
    }

    // =====================================
    // ADMIN ADD
    // =====================================

    if (
      data === "admin_add"
    ) {

      const ativo =
      await possuiPlano(
        userId
      );

      if (
        userId !== MASTER &&
        !ADMINS.includes(userId) &&
        !ativo
      ) {

        return bot.sendMessage(
          q.message.chat.id,
          "❌ Seu plano expirou"
        );
      }

      userState[userId] = {
        step: "imagem"
      };

      return bot.sendMessage(
        q.message.chat.id,

`🖼 ENVIE O LINK DA IMAGEM

Exemplo:
https://site.com/img.jpg`
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
 
