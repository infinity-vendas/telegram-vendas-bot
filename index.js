// =========================================
// SELLFORGE MARKETPLACE
// BOT ALUGUEL + LOJAS INDIVIDUAIS
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

const BOT_USERNAME =
"SellForge_bot";

const LOGO =
"https://i.postimg.cc/g2JJvqHN/logo.jpg";

// =========================================
// PLANOS
// =========================================

const PLANS = {

  teste: {
    nome: "TESTE 1 MINUTO",
    valor: 0.01,
    dias: 0,
    minutos: 1
  },

  p3: {
    nome: "3 DIAS",
    valor: 0.97,
    dias: 3
  },

  p7: {
    nome: "7 DIAS",
    valor: 1.99,
    dias: 7
  },

  p14: {
    nome: "14 DIAS",
    valor: 2.60,
    dias: 14
  },

  p21: {
    nome: "21 DIAS",
    valor: 3.90,
    dias: 21
  },

  p30: {
    nome: "30 DIAS",
    valor: 5.00,
    dias: 30
  }
};

// =========================================
// SISTEMAS
// =========================================

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
});

// =========================================
// HOME
// =========================================

app.get('/', (req, res) => {

  res.send(
    "🚀 SELLFORGE ONLINE"
  );
});

// =========================================
// VERIFICAR PLANO
// =========================================

async function hasPlan(userId){

  if(
    userId === MASTER ||
    ADMINS.includes(userId)
  ){
    return true;
  }

  const doc =
  await db
  .collection('vendedores')
  .doc(userId)
  .get();

  if(!doc.exists)
    return false;

  const data =
  doc.data();

  if(!data.expira)
    return false;

  return Date.now() <
  data.expira;
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

    if(
      data.type !== "payment"
    ){
      return res.sendStatus(200);
    }

    const payment =
    await mpPayment.get({
      id:
      data.data.id
    });

    if(
      payment.status !==
      "approved"
    ){
      return res.sendStatus(200);
    }

    const ref =
    db.collection(
      'pagamentos'
    )
    .doc(
      String(payment.id)
    );

    const doc =
    await ref.get();

    if(!doc.exists)
      return res.sendStatus(200);

    const info =
    doc.data();

    if(info.aprovado)
      return res.sendStatus(200);

    await ref.update({

      aprovado: true,

      status:
      "approved"
    });

    // =====================================
    // PLANO
    // =====================================

    if(
      info.tipo === "plano"
    ){

      const vendedorRef =
      db.collection(
        'vendedores'
      )
      .doc(info.userId);

      const vendedorDoc =
      await vendedorRef.get();

      let antigo =
      0;

      if(
        vendedorDoc.exists
      ){

        antigo =
        vendedorDoc.data()
        .expira || 0;
      }

      let novoTempo;

      if(info.minutos){

        novoTempo =
        Date.now() + (
          info.minutos *
          60 *
          1000
        );

      } else {

        novoTempo =
        Date.now() + (
          info.dias *
          24 *
          60 *
          60 *
          1000
        );
      }

      await vendedorRef.set({

        userId:
        info.userId,

        username:
        info.username,

        loja:
        info.loja,

        expira:
        novoTempo,

        plano:
        info.plano,

        createdAt:
        Date.now()

      }, {
        merge: true
      });

      const linkLoja =
`https://t.me/${BOT_USERNAME}?start=loja_${info.loja}`;

      await bot.sendMessage(
        info.chatId,

`✅ PLANO ATIVADO!

━━━━━━━━━━━━━━━━━━━

🏪 SUA LOJA:
${info.loja}

📦 PLANO:
${info.plano}

⏳ EXPIRAÇÃO:
${new Date(novoTempo).toLocaleString()}

━━━━━━━━━━━━━━━━━━━

🔗 LINK DA SUA LOJA:

${linkLoja}

━━━━━━━━━━━━━━━━━━━

📌 COMANDOS:

/addproduto
/meusprodutos
/minhaloja
/renovar
/cancelarplano

━━━━━━━━━━━━━━━━━━━

🚀 Agora você já pode vender!`
      );

      return res.sendStatus(200);
    }

    // =====================================
    // ENTREGA PRODUTO
    // =====================================

    await bot.sendMessage(
      info.chatId,

`✅ PAGAMENTO APROVADO!

━━━━━━━━━━━━━━━━━━━

📦 Produto:
${info.produto}

💰 Valor:
R$ ${info.valor}

👤 Vendedor:
${info.vendedor}

📲 WhatsApp:
${info.whatsapp}

━━━━━━━━━━━━━━━━━━━

🔓 LINK DO PRODUTO:

${info.link}

━━━━━━━━━━━━━━━━━━━

🚀 Obrigado pela compra!`
    );

    res.sendStatus(200);

  } catch(err){

    console.log(err);

    res.sendStatus(500);
  }
});

// =========================================
// START
// =========================================

bot.onText(
/\/start(.*)/,
async (msg, match) => {

  try {

    const chatId =
    msg.chat.id;

    const userId =
    String(msg.from.id);

    const param =
    match[1]
    .trim();

    // =====================================
    // LOJA INDIVIDUAL
    // =====================================

    if(
      param.startsWith(
        "loja_"
      )
    ){

      const loja =
      param.replace(
        "loja_",
        ""
      );

      const snap =
      await db
      .collection('produtos')
      .where(
        'loja',
        '==',
        loja
      )
      .get();

      if(
        snap.empty
      ){

        return bot.sendMessage(
          chatId,
          "❌ Loja vazia"
        );
      }

      const buttons = [];

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

`🏪 LOJA: ${loja}

Selecione um produto:`,

{
  reply_markup: {
    inline_keyboard:
    buttons
  }
}
      );
    }

    // =====================================
    // MENU
    // =====================================

    await bot.sendPhoto(
      chatId,
      LOGO,
{
  caption:

`🚀 SELLFORGE MARKETPLACE

━━━━━━━━━━━━━━━━━━━

✅ PIX automático
✅ Aprovação automática
✅ Entrega automática
✅ Loja individual
✅ Link personalizado
✅ Produtos ilimitados

━━━━━━━━━━━━━━━━━━━

⚠️ Para vender dentro
da plataforma é necessário
adquirir um plano.

👇 Escolha uma opção abaixo`
}
    );

    await bot.sendMessage(
      chatId,

`📋 MENU PRINCIPAL`,

{
  reply_markup: {
    inline_keyboard: [

      [
        {
          text:
          "💎 ALUGAR BOT",

          callback_data:
          "alugar_bot"
        }
      ],

      [
        {
          text:
          "🔄 RENOVAR",

          callback_data:
          "renovar_plano"
        }
      ],

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
    // ADMIN
    // =====================================

    if(
      userId === MASTER ||
      ADMINS.includes(userId)
    ){

      await bot.sendMessage(
        chatId,

`🔐 ADMIN SECRETO`,

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
          "🗑 DELETAR PRODUTO",

          callback_data:
          "admin_delete"
        }
      ],

      [
        {
          text:
          "🏪 MINHA LOJA",

          callback_data:
          "minha_loja"
        }
      ]
    ]
  }
}
      );
    }

  } catch(err){

    console.log(err);
  }
});

// =========================================
// CALLBACK
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
    // ALUGAR BOT
    // =====================================

    if(
      data === "alugar_bot"
    ){

      return bot.sendMessage(
        q.message.chat.id,

`💎 ESCOLHA UM PLANO`,

{
  reply_markup: {
    inline_keyboard: [

      [
        {
          text:
          "🧪 TESTE 1 MIN - R$0,01",

          callback_data:
          "plan_teste"
        }
      ],

      [
        {
          text:
          "3 DIAS - R$0,97",

          callback_data:
          "plan_p3"
        }
      ],

      [
        {
          text:
          "7 DIAS - R$1,99",

          callback_data:
          "plan_p7"
        }
      ],

      [
        {
          text:
          "14 DIAS - R$2,60",

          callback_data:
          "plan_p14"
        }
      ],

      [
        {
          text:
          "21 DIAS - R$3,90",

          callback_data:
          "plan_p21"
        }
      ],

      [
        {
          text:
          "30 DIAS - R$5,00",

          callback_data:
          "plan_p30"
        }
      ]
    ]
  }
}
      );
    }

    // =====================================
    // PLANOS
    // =====================================

    if(
      data.startsWith(
        "plan_"
      )
    ){

      const key =
      data.replace(
        "plan_",
        ""
      );

      const plan =
      PLANS[key];

      if(!plan)
        return;

      const vendedorDoc =
      await db
      .collection('vendedores')
      .doc(userId)
      .get();

      // =====================================
      // TESTE 1 VEZ
      // =====================================

      if(
        key === "teste" &&
        vendedorDoc.exists &&
        vendedorDoc.data()
        .testeUsado
      ){

        return bot.sendMessage(
          q.message.chat.id,

`❌ Você já utilizou o plano teste.`
        );
      }

      userState[userId] = {

        step:
        "criar_loja",

        planKey:
        key
      };

      return bot.sendMessage(
        q.message.chat.id,

`🏪 DIGITE O NOME DA SUA LOJA

Exemplo:
minhaloja`
      );
    }

    // =====================================
    // VER PRODUTO
    // =====================================

    if(
      data.startsWith(
        "view_"
      )
    ){

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

      if(!doc.exists){

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

💰 R$ ${p.preco}

📝 ${p.desc}

👤 ${p.vendedor}`,

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
    // COMPRAR PRODUTO
    // =====================================

    if(
      data.startsWith(
        "buy_"
      )
    ){

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

      if(!doc.exists){

        return bot.sendMessage(
          q.message.chat.id,
          "❌ Produto removido"
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

        tipo:
        "produto",

        chatId:
        q.message.chat.id,

        produto:
        p.nome,

        valor:
        p.preco,

        whatsapp:
        p.whatsapp,

        vendedor:
        p.vendedor,

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

━━━━━━━━━━━━━━━━━━━

📋 PIX COPIA E COLA:

${copia}

━━━━━━━━━━━━━━━━━━━

⏳ Aguardando pagamento...`
}
      );
    }

  } catch(err){

    console.log(err);
  }
});

// =========================================
// COMANDOS
// =========================================

bot.onText(
/\/addproduto/,
async (msg) => {

  const userId =
  String(msg.from.id);

  const ativo =
  await hasPlan(userId);

  if(!ativo){

    return bot.sendMessage(
      msg.chat.id,

`❌ Você precisa adquirir um plano primeiro.`
    );
  }

  userState[userId] = {
    step: "img"
  };

  bot.sendMessage(
    msg.chat.id,

`🖼 ENVIE O LINK DA IMAGEM`
  );
});

bot.onText(
/\/minhaloja/,
async (msg) => {

  const userId =
  String(msg.from.id);

  const doc =
  await db
  .collection('vendedores')
  .doc(userId)
  .get();

  if(!doc.exists){

    return bot.sendMessage(
      msg.chat.id,
      "❌ Loja não encontrada"
    );
  }

  const loja =
  doc.data().loja;

  const link =
`https://t.me/${BOT_USERNAME}?start=loja_${loja}`;

  bot.sendMessage(
    msg.chat.id,

`🏪 SUA LOJA

🔗 ${link}`
  );
});

// =========================================
// MENSAGENS
// =========================================

bot.on(
"message",
async (msg) => {

  try {

    if(!msg.text)
      return;

    const userId =
    String(msg.from.id);

    const text =
    msg.text;

    if(
      text.startsWith("/")
    ) return;

    const state =
    userState[userId];

    if(!state)
      return;

    // =====================================
    // CRIAR LOJA
    // =====================================

    if(
      state.step ===
      "criar_loja"
    ){

      const loja =
      text
      .toLowerCase()
      .replace(/\s+/g,'');

      const plan =
      PLANS[
        state.planKey
      ];

      const payment =
      await mpPayment.create({

        body: {

          transaction_amount:
          Number(plan.valor),

          description:
          `Plano ${plan.nome}`,

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

        tipo:
        "plano",

        chatId:
        msg.chat.id,

        userId,

        username:
        msg.from.username || "",

        loja,

        plano:
        plan.nome,

        dias:
        plan.dias || 0,

        minutos:
        plan.minutos || 0,

        aprovado:
        false,

        createdAt:
        Date.now()
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

`💎 PAGAMENTO DO PLANO

🏪 LOJA:
${loja}

📦 PLANO:
${plan.nome}

💰 VALOR:
R$ ${plan.valor}

━━━━━━━━━━━━━━━━━━━

📋 PIX COPIA E COLA:

${copia}

━━━━━━━━━━━━━━━━━━━

⏳ Após pagamento
sua loja será liberada.`
}
      );
    }

    // =====================================
    // ADD PRODUTOS
    // =====================================

    if(
      state.step === "img"
    ){

      state.img = text;
      state.step = "nome";

      return bot.sendMessage(
        msg.chat.id,
        "📦 Nome do produto:"
      );
    }

    if(
      state.step === "nome"
    ){

      state.nome = text;
      state.step = "valor";

      return bot.sendMessage(
        msg.chat.id,
        "💰 Valor:"
      );
    }

    if(
      state.step === "valor"
    ){

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

    if(
      state.step === "descricao"
    ){

      state.desc = text;
      state.step = "pix";

      return bot.sendMessage(
        msg.chat.id,
        "💳 Chave PIX:"
      );
    }

    if(
      state.step === "pix"
    ){

      state.pix = text;
      state.step = "whatsapp";

      return bot.sendMessage(
        msg.chat.id,
        "📲 WhatsApp:"
      );
    }

    if(
      state.step === "whatsapp"
    ){

      state.whatsapp = text;
      state.step = "link";

      return bot.sendMessage(
        msg.chat.id,
        "🔗 Link do produto:"
      );
    }

    if(
      state.step === "link"
    ){

      const vendedor =
      await db
      .collection('vendedores')
      .doc(userId)
      .get();

      const loja =
      vendedor.data().loja;

      await db
      .collection('produtos')
      .add({

        vendedor:
        loja,

        loja,

        img:
        state.img,

        nome:
        state.nome,

        preco:
        state.preco,

        desc:
        state.desc,

        pix:
        state.pix,

        whatsapp:
        state.whatsapp,

        link:
        text,

        createdAt:
        Date.now()
      });

      userState[userId] =
      null;

      const lojaLink =
`https
