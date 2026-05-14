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

app.use(express.json());

// ========================================
// CONFIG
// ========================================

const MASTER = "6863505946";

const BOT_USERNAME =
"SellForge_bot";

const LOGO =
"https://i.postimg.cc/g2JJvqHN/logo.jpg";

const SUPPORT =
"@suporte_inifnity_clientes_oficial";

// ========================================
// PLANOS
// ========================================

const PLANOS = {

  "1": {
    nome: "1 Dia",
    preco: 0.97,
    dias: 1
  },

  "2": {
    nome: "2 Dias",
    preco: 2.15,
    dias: 2
  },

  "3": {
    nome: "3 Dias",
    preco: 2.80,
    dias: 3
  },

  "4": {
    nome: "4 Dias",
    preco: 4.60,
    dias: 4
  },

  "5": {
    nome: "5 Dias",
    preco: 6.00,
    dias: 5
  },

  "6": {
    nome: "6 Dias",
    preco: 8.00,
    dias: 6
  },

  "7": {
    nome: "7 Dias",
    preco: 10.00,
    dias: 7
  },

  "8": {
    nome: "8 Dias",
    preco: 14.00,
    dias: 8
  },

  "9": {
    nome: "9 Dias",
    preco: 16.00,
    dias: 9
  },

  "10": {
    nome: "10 Dias",
    preco: 18.00,
    dias: 10
  },

  "20": {
    nome: "20 Dias",
    preco: 30.00,
    dias: 20
  },

  "30": {
    nome: "30 Dias",
    preco: 60.00,
    dias: 30
  }
};

// ========================================
// ESTADOS
// ========================================

const userState = {};

// ========================================
// VALIDAÇÕES
// ========================================

if (!process.env.BOT_TOKEN)
  throw new Error("BOT_TOKEN ausente");

if (!process.env.MP_ACCESS_TOKEN)
  throw new Error("MP_ACCESS_TOKEN ausente");

if (!process.env.FIREBASE_CONFIG)
  throw new Error("FIREBASE_CONFIG ausente");

if (!process.env.RENDER_EXTERNAL_URL)
  throw new Error("RENDER_EXTERNAL_URL ausente");

// ========================================
// FIREBASE
// ========================================

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

// ========================================
// MERCADO PAGO
// ========================================

const mpClient =
new MercadoPagoConfig({

  accessToken:
  process.env.MP_ACCESS_TOKEN
});

const mpPayment =
new Payment(mpClient);

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

app.get('/', (req, res) => {

  res.send(
    "🚀 SELLFORGE ONLINE"
  );
});

// ========================================
// VERIFICAR PLANO
// ========================================

async function sellerActive(userId) {

  const doc =
  await db
  .collection('sellers')
  .doc(userId)
  .get();

  if (!doc.exists)
    return false;

  const data =
  doc.data();

  if (
    !data.expiraEm
  ) return false;

  return (
    Date.now() <
    data.expiraEm
  );
}

// ========================================
// START
// ========================================

bot.onText(
/\/start(.*)/,
async (msg, match) => {

  try {

    const chatId =
    msg.chat.id;

    const args =
    match[1];

    // ====================================
    // LOJA VENDEDOR
    // ====================================

    if (
      args &&
      args.includes("loja_")
    ) {

      const sellerId =
      args
      .replace(" loja_", "")
      .trim();

      const ativo =
      await sellerActive(
        sellerId
      );

      if (!ativo) {

        return bot.sendMessage(
          chatId,

`⛔ Loja indisponível.

Plano expirado.`
        );
      }

      const sellerDoc =
      await db
      .collection('sellers')
      .doc(sellerId)
      .get();

      if (!sellerDoc.exists) {

        return bot.sendMessage(
          chatId,
          "❌ Loja não encontrada"
        );
      }

      const seller =
      sellerDoc.data();

      const produtos =
      await db
      .collection('produtos')
      .where(
        "sellerId",
        "==",
        sellerId
      )
      .get();

      if (
        produtos.empty
      ) {

        return bot.sendMessage(
          chatId,

`📦 Loja sem produtos`
        );
      }

      const buttons = [];

      produtos.forEach(doc => {

        const p =
        doc.data();

        buttons.push([{

          text:
`${p.nome} - R$ ${p.preco}`,

          callback_data:
`buy_${doc.id}`
        }]);
      });

      return bot.sendMessage(
        chatId,

`🏪 ${seller.loja}

📦 Produtos disponíveis:`,

{
  reply_markup: {
    inline_keyboard:
    buttons
  }
}
      );
    }

    // ====================================
    // MENU
    // ====================================

    await bot.sendPhoto(
      chatId,
      LOGO,
{
  caption:

`🚀 SELLFORGE BOT

💰 Alugue sua loja
📦 Venda produtos
⚡ PIX automático
🏪 Sua própria loja

📲 Suporte:
${SUPPORT}`
}
    );

    await bot.sendMessage(
      chatId,

`👇 Escolha uma opção`,

{
  reply_markup: {

    inline_keyboard: [

      [
        {
          text:
          "💰 ALUGAR BOT",

          callback_data:
          "alugar_bot"
        }
      ],

      [
        {
          text:
          "🏪 MINHA LOJA",

          callback_data:
          "minha_loja"
        }
      ],

      [
        {
          text:
          "➕ ADD PRODUTO",

          callback_data:
          "add_produto"
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
// CALLBACK
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
    // ALUGAR BOT
    // ====================================

    if (
      data === "alugar_bot"
    ) {

      const buttons = [];

      Object.keys(PLANOS)
      .forEach(key => {

        const p =
        PLANOS[key];

        buttons.push([{

          text:
`${p.nome} - R$ ${p.preco}`,

          callback_data:
`plan_${key}`
        }]);
      });

      return bot.sendMessage(
        q.message.chat.id,

`💰 ESCOLHA UM PLANO`,

{
  reply_markup: {
    inline_keyboard:
    buttons
  }
}
      );
    }

    // ====================================
    // GERAR PIX
    // ====================================

    if (
      data.startsWith(
        "plan_"
      )
    ) {

      const idPlano =
      data.replace(
        "plan_",
        ""
      );

      const plano =
      PLANOS[idPlano];

      const payment =
      await mpPayment.create({

        body: {

          transaction_amount:
          plano.preco,

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

      await db
      .collection('payments')
      .doc(
        String(payment.id)
      )
      .set({

        tipo:
        "plano",

        sellerId:
        userId,

        plano:
        idPlano,

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

`💳 PAGAMENTO PIX

📦 ${plano.nome}

💰 R$ ${plano.preco}

PIX:

${copia}`
}
      );
    }

    // ====================================
    // MINHA LOJA
    // ====================================

    if (
      data === "minha_loja"
    ) {

      const ativo =
      await sellerActive(
        userId
      );

      if (!ativo) {

        return bot.sendMessage(
          q.message.chat.id,

`⛔ Seu plano expirou.

Renove para continuar.`
        );
      }

      const doc =
      await db
      .collection('sellers')
      .doc(userId)
      .get();

      const seller =
      doc.data();

      return bot.sendMessage(
        q.message.chat.id,

`🏪 SUA LOJA

👤 ${seller.loja}

🔗 LINK:

https://t.me/${BOT_USERNAME}?start=loja_${userId}`
      );
    }

    // ====================================
    // ADD PRODUTO
    // ====================================

    if (
      data === "add_produto"
    ) {

      const ativo =
      await sellerActive(
        userId
      );

      if (!ativo) {

        return bot.sendMessage(
          q.message.chat.id,

`⛔ Compre um plano primeiro`
        );
      }

      userState[userId] = {

        step: "nome"
      };

      return bot.sendMessage(
        q.message.chat.id,

`📦 Nome produto`
      );
    }

    // ====================================
    // COMPRAR PRODUTO
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
      .collection('produtos')
      .doc(idProduto)
      .get();

      if (!doc.exists) {

        return bot.sendMessage(
          q.message.chat.id,

`❌ Produto removido`
        );
      }

      const p =
      doc.data();

      return bot.sendMessage(
        q.message.chat.id,

`💳 PAGAMENTO

📦 ${p.nome}

💰 R$ ${p.preco}

🔑 PIX:

${p.pix}`
      );
    }

  } catch (err) {

    console.log(
      "CALLBACK ERROR:",
      err
    );
  }
});

// ========================================
// MENSAGENS
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

    const state =
    userState[userId];

    if (
      text.startsWith("/")
    ) return;

    if (!state)
      return;

    // ====================================
    // NOME
    // ====================================

    if (
      state.step === "nome"
    ) {

      state.nome =
      text;

      state.step =
      "preco";

      return bot.sendMessage(
        msg.chat.id,
        "💰 Valor"
      );
    }

    // ====================================
    // PREÇO
    // ====================================

    if (
      state.step === "preco"
    ) {

      state.preco =
      Number(
        text.replace(",", ".")
      );

      state.step =
      "desc";

      return bot.sendMessage(
        msg.chat.id,
        "📝 Descrição"
      );
    }

    // ====================================
    // DESC
    // ====================================

    if (
      state.step === "desc"
    ) {

      state.desc =
      text;

      state.step =
      "pix";

      return bot.sendMessage(
        msg.chat.id,
        "🔑 Chave PIX"
      );
    }

    // ====================================
    // PIX
    // ====================================

    if (
      state.step === "pix"
    ) {

      state.pix =
      text;

      state.step =
      "img";

      return bot.sendMessage(
        msg.chat.id,
        "🖼 Link imagem"
      );
    }

    // ====================================
    // IMG
    // ====================================

    if (
      state.step === "img"
    ) {

      const sellerDoc =
      await db
      .collection('sellers')
      .doc(userId)
      .get();

      const seller =
      sellerDoc.data();

      await db
      .collection('produtos')
      .add({

        sellerId:
        userId,

        loja:
        seller.loja,

        nome:
        state.nome,

        preco:
        state.preco,

        desc:
        state.desc,

        pix:
        state.pix,

        img:
        text,

        createdAt:
        Date.now()
      });

      userState[userId] =
      null;

      return bot.sendMessage(
        msg.chat.id,

`✅ PRODUTO ADICIONADO`
      );
    }

  } catch (err) {

    console.log(
      "MESSAGE ERROR:",
      err
    );
  }
});

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

    const payDoc =
    await db
    .collection('payments')
    .doc(
      String(payment.id)
    )
    .get();

    if (!payDoc.exists)
      return res.sendStatus(200);

    const info =
    payDoc.data();

    if (
      info.aprovado
    ) {

      return res.sendStatus(200);
    }

    const plano =
    PLANOS[
      info.plano
    ];

    await db
    .collection('payments')
    .doc(
      String(payment.id)
    )
    .update({

      aprovado: true
    });

    const expiraEm =
    Date.now() + (

      plano.dias *
      24 *
      60 *
      60 *
      1000
    );

    const sellerRef =
    db
    .collection('sellers')
    .doc(
      info.sellerId
    );

    const sellerDoc =
    await sellerRef.get();

    if (!sellerDoc.exists) {

      await sellerRef.set({

        loja:
`Loja_${info.sellerId}`,

        ativo: true,

        expiraEm
      });

    } else {

      await sellerRef.update({

        ativo: true,

        expiraEm
      });
    }

    await bot.sendMessage(
      info.sellerId,

`✅ PLANO ATIVADO

🚀 Agora você pode vender.

🏪 Sua loja:

https://t.me/${BOT_USERNAME}?start=loja_${info.sellerId}`
    );

    res.sendStatus(200);

  } catch (err) {

    console.log(
      "WEBHOOK ERROR:",
      err
    );

    res.sendStatus(500);
  }
});

// ========================================
// SERVER
// ========================================

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
