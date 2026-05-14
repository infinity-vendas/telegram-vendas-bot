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

// ========================================
// EXPRESS
// ========================================

const app = express();

app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));

// ========================================
// CONFIG
// ========================================

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

// ========================================
// PLANOS
// ========================================

const PLANOS = {

  test: {
    nome: "TESTE 1 MIN",
    valor: 0.01,
    minutos: 1
  },

  d3: {
    nome: "3 DIAS",
    valor: 0.97,
    dias: 3
  },

  d7: {
    nome: "7 DIAS",
    valor: 1.99,
    dias: 7
  },

  d14: {
    nome: "14 DIAS",
    valor: 2.60,
    dias: 14
  },

  d21: {
    nome: "21 DIAS",
    valor: 3.90,
    dias: 21
  },

  d30: {
    nome: "30 DIAS",
    valor: 5.00,
    dias: 30
  }
};

// ========================================
// VALIDAÇÕES
// ========================================

if (!process.env.BOT_TOKEN)
  throw new Error(
    "BOT_TOKEN ausente"
  );

if (!process.env.MP_ACCESS_TOKEN)
  throw new Error(
    "MP_ACCESS_TOKEN ausente"
  );

if (!process.env.RENDER_EXTERNAL_URL)
  throw new Error(
    "RENDER_EXTERNAL_URL ausente"
  );

if (!process.env.FIREBASE_CONFIG)
  throw new Error(
    "FIREBASE_CONFIG ausente"
  );

// ========================================
// MERCADO PAGO
// ========================================

const mpClient =
new MercadoPagoConfig({

  accessToken:
  process.env
  .MP_ACCESS_TOKEN
});

const mpPayment =
new Payment(mpClient);

// ========================================
// FIREBASE
// ========================================

const serviceAccount =
JSON.parse(
  process.env
  .FIREBASE_CONFIG
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

// ========================================
// TELEGRAM
// ========================================

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

// ========================================
// HOME
// ========================================

app.get('/',

(req, res) => {

  res.send(
    "🚀 BOT ONLINE"
  );
});

// ========================================
// VERIFICAR PLANO
// ========================================

async function possuiPlano(
  userId
){

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

  return Date.now()
  < data.expiraEm;
}

// ========================================
// WEBHOOK MP
// ========================================

app.post(
'/webhook/mp',

async (req, res) => {

  try {

    const data =
    req.body;

    if (
      data.type !==
      "payment"
    ) {

      return res
      .sendStatus(200);
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

      return res
      .sendStatus(200);
    }

    const pagamentoRef =
    db.collection(
      "pagamentos"
    )
    .doc(
      String(payment.id)
    );

    const pagamentoDoc =
    await pagamentoRef
    .get();

    if (
      !pagamentoDoc.exists
    ) {

      return res
      .sendStatus(200);
    }

    const info =
    pagamentoDoc.data();

    if (
      info.aprovado
    ) {

      return res
      .sendStatus(200);
    }

    await pagamentoRef
    .update({

      aprovado: true,

      status:
      "approved"
    });

    // ====================================
    // PAGAMENTO PLANO
    // ====================================

    if (
      info.tipo ===
      "plano"
    ) {

      const plano =
      PLANOS[
        info.plano
      ];

      let expiraEm =
      Date.now();

      if (
        plano.minutos
      ) {

        expiraEm +=
        plano.minutos *
        60 *
        1000;
      }

      if (
        plano.dias
      ) {

        expiraEm +=
        plano.dias *
        24 *
        60 *
        60 *
        1000;
      }

      await db
      .collection(
        "vendedores"
      )
      .doc(info.userId)
      .set({

        loja:
        info.loja,

        expiraEm,

        ativo: true

      }, {
        merge: true
      });

      const linkLoja =
`https://t.me/${BOT_USERNAME}?start=loja_${info.loja}`;

      await bot.sendMessage(

        info.chatId,

`✅ PLANO APROVADO

━━━━━━━━━━━━━━━━━━━

👤 SUA LOJA:
${info.loja}

📅 PLANO:
${plano.nome}

🔗 LINK DA LOJA:

${linkLoja}

━━━━━━━━━━━━━━━━━━━

✅ Agora você já pode:

➕ Adicionar produtos
📦 Compartilhar loja
💰 Receber vendas

━━━━━━━━━━━━━━━━━━━

🚀 Use /start`
      );

      return res
      .sendStatus(200);
    }

    // ====================================
    // ENTREGA PRODUTO
    // ====================================

    await bot.sendMessage(

      info.chatId,

`✅ PAGAMENTO APROVADO

━━━━━━━━━━━━━━━━━━━

📦 Produto:
${info.produto}

💰 Valor:
R$ ${info.valor}

━━━━━━━━━━━━━━━━━━━

🔓 LINK LIBERADO:

${info.link}

━━━━━━━━━━━━━━━━━━━

📲 WhatsApp:
${info.whatsapp}

🚀 Obrigado pela compra`
    );

    return res
    .sendStatus(200);

  } catch (err) {

    console.log(
      "❌ WEBHOOK:",
      err
    );

    res.sendStatus(500);
  }
});

// ========================================
// START
// ========================================

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

    // ====================================
    // ABRIR LOJA
    // ====================================

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
      .collection(
        "produtos"
      )
      .where(
        "loja",
        "==",
        loja
      )
      .get();

      if (
        snap.empty
      ) {

        return bot
        .sendMessage(

          chatId,

          "❌ Loja vazia"
        );
      }

      const buttons =
      [];

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

        chatId,

`🛒 LOJA ${loja}

━━━━━━━━━━━━━━━━━━━

📦 Produtos disponíveis abaixo 👇`,

{
  reply_markup: {
    inline_keyboard:
    buttons
  }
}
      );
    }

    // ====================================
    // AUDIO
    // ====================================

    await bot.sendAudio(
      chatId,
      AUDIO
    );

    // ====================================
    // FOTO
    // ====================================

    await bot.sendPhoto(

      chatId,
      LOGO,

{
  caption:

`🚀 Bem-vindo(a)

━━━━━━━━━━━━━━━━━━━

✅ PIX automático
✅ Entrega automática
✅ Loja própria
✅ Produtos ilimitados
✅ Mercado Pago
✅ Sistema online

━━━━━━━━━━━━━━━━━━━

💎 Alugue seu bot
e comece vender hoje

👇 Escolha abaixo`
}
    );

    const ativo =
    await possuiPlano(
      userId
    );

    // ====================================
    // SEM PLANO
    // ====================================

    if (!ativo) {

      return bot.sendMessage(

        chatId,

`💎 ALUGAR BOT

━━━━━━━━━━━━━━━━━━━

🧪 TESTE 1 MIN
R$ 0,01

📅 3 DIAS
R$ 0,97

📅 7 DIAS
R$ 1,99

📅 14 DIAS
R$ 2,60

📅 21 DIAS
R$ 3,90

📅 30 DIAS
R$ 5,00

━━━━━━━━━━━━━━━━━━━

⚠️ É necessário
ter plano ativo
para usar o sistema.`,

{
  reply_markup: {
    inline_keyboard: [

      [
        {
          text:
          "🧪 TESTE",

          callback_data:
          "plano_test"
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

    // ====================================
    // PAINEL VENDEDOR
    // ====================================

    const vendedorDoc =
    await db
    .collection(
      "vendedores"
    )
    .doc(userId)
    .get();

    const vendedor =
    vendedorDoc.data();

    const linkLoja =
`https://t.me/${BOT_USERNAME}?start=loja_${vendedor.loja}`;

    await bot.sendMessage(

      chatId,

`🚀 PAINEL VENDEDOR

━━━━━━━━━━━━━━━━━━━

👤 LOJA:
${vendedor.loja}

🔗 LINK:
${linkLoja}

━━━━━━━━━━━━━━━━━━━

📦 Compartilhe sua loja
e receba vendas automáticas.`,

{
  reply_markup: {
    inline_keyboard: [

      [
        {
          text:
          "➕ ADD PRODUTO",

          callback_data:
          "add_produto"
        }
      ],

      [
        {
          text:
          "📦 MINHA LOJA",

          callback_data:
          "minha_loja"
        }
      ],

      [
        {
          text:
          "🗑 ZERAR LOJA",

          callback_data:
          "zerar_loja"
        }
      ],

      [
        {
          text:
          "🔄 RENOVAR",

          callback_data:
          "renovar"
        }
      ],

      [
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
      "❌ START:",
      err
    );
  }
});

// ========================================
// STAFF DONO
// ========================================

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

`🔐 PAINEL ADMIN SECRETO`,

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

// ========================================
// CALLBACKS
// ========================================

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

    // ====================================
    // PLANOS
    // ====================================

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
      PLANOS[
        planoId
      ];

      if (!plano)
        return;

      userState[userId] = {

        step:
        "nome_loja",

        plano:
        planoId
      };

      return bot.sendMessage(

        q.message.chat.id,

`📝 Digite o nome da sua loja

Exemplo:
minhaloja`
      );
    }

    // ====================================
    // ADD PRODUTO
    // ====================================

    if (
      data ===
      "add_produto"
    ) {

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

    // ====================================
    // MINHA LOJA
    // ====================================

    if (
      data ===
      "minha_loja"
    ) {

      const vendedorDoc =
      await db
      .collection(
        "vendedores"
      )
      .doc(userId)
      .get();

      const vendedor =
      vendedorDoc.data();

      const link =
`https://t.me/${BOT_USERNAME}?start=loja_${vendedor.loja}`;

      return bot.sendMessage(

        q.message.chat.id,

`🔗 SUA LOJA

${link}`
      );
    }

    // ====================================
    // ZERAR LOJA
    // ====================================

    if (
      data ===
      "zerar_loja"
    ) {

      const vendedorDoc =
      await db
      .collection(
        "vendedores"
      )
      .doc(userId)
      .get();

      const vendedor =
      vendedorDoc.data();

      const snap =
      await db
      .collection(
        "produtos"
      )
      .where(
        "loja",
        "==",
        vendedor.loja
      )
      .get();

      for (
        const doc of snap.docs
      ) {

        await db
        .collection(
          "produtos"
        )
        .doc(doc.id)
        .delete();
      }

      return bot.sendMessage(

        q.message.chat.id,

        "🗑 Loja zerada"
      );
    }

    // ====================================
    // RENOVAR
    // ====================================

    if (
      data ===
      "renovar"
    ) {

      return bot.sendMessage(

        q.message.chat.id,

`💎 ESCOLHA UM NOVO PLANO`,

{
  reply_markup: {
    inline_keyboard: [

      [
        {
          text:
          "3 DIAS",

          callback_data:
          "plano_d3"
        }
      ],

      [
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

    // ====================================
    // VIEW PRODUTO
    // ====================================

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
      .collection(
        "produtos"
      )
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

💰 VALOR:
R$ ${p.preco}

📝 DESCRIÇÃO:
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

    // ====================================
    // BUY
    // ====================================

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
      .collection(
        "produtos"
      )
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
      .collection(
        "pagamentos"
      )
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

`💰 PAGAMENTO PIX

━━━━━━━━━━━━━━━━━━━

📦 ${p.nome}

💲 R$ ${p.preco}

━━━━━━━━━━━━━━━━━━━

📋 PIX COPIA E COLA:

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

// ========================================
// MESSAGE
// ========================================

bot.on(

"message",

async (msg) => {

  try {

    if (!msg.text)
      return;

    const userId =
    String(msg.from.id);

    const text =
    msg.text;

    if (
      text.startsWith("/")
    ) return;

    const state =
    userState[userId];

    if (!state)
      return;

    // ====================================
    // NOME LOJA
    // ====================================

    if (
      state.step ===
      "nome_loja"
    ) {

      state.loja =
      text
      .toLowerCase()
      .replace(/\s+/g,'');

      const plano =
      PLANOS[
        state.plano
      ];

      const payment =
      await mpPayment.create({

        body: {

          transaction_amount:
          Number(plano.valor),

          description:
          plano.nome,

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
      .collection(
        "pagamentos"
      )
      .doc(
        String(payment.id)
      )
      .set({

        tipo:
        "plano",

        plano:
        state.plano,

        userId,

        chatId:
        msg.chat.id,

        loja:
        state.loja,

        aprovado:
        false
      });

      userState[userId] =
      null;

      return bot.sendPhoto(

        msg.chat.id,

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

━━━━━━━━━━━━━━━━━━━

📋 PIX COPIA E COLA:

${copia}

━━━━━━━━━━━━━━━━━━━

⏳ Aguardando pagamento`
}
      );
    }

    // ====================================
    // ADD PRODUTO
    // ====================================

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

        "📦 Nome do produto:"
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

      return bot.sendM
