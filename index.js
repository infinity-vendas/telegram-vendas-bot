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

const LOGO =
"https://i.postimg.cc/g2JJvqHN/logo.jpg";

const WHATSAPP =
"551981528372";

const BOT_USERNAME =
"SellForge_bot";

// =========================================
// PLANOS
// =========================================

const PLANOS = {

  teste: {
    nome: "TESTE 1 MINUTO",
    valor: 0.01,
    minutos: 1
  },

  plano3: {
    nome: "3 DIAS",
    valor: 0.97,
    dias: 3
  },

  plano7: {
    nome: "7 DIAS",
    valor: 1.99,
    dias: 7
  },

  plano14: {
    nome: "14 DIAS",
    valor: 2.60,
    dias: 14
  },

  plano21: {
    nome: "21 DIAS",
    valor: 3.90,
    dias: 21
  },

  plano30: {
    nome: "30 DIAS",
    valor: 5.00,
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
// MEMORY
// =========================================

const userState = {};

// =========================================
// FUNÇÕES
// =========================================

async function getSeller(userId){

  const doc =
  await db
  .collection("vendedores")
  .doc(userId)
  .get();

  if(!doc.exists)
    return null;

  return doc.data();
}

async function hasPlan(userId){

  const seller =
  await getSeller(userId);

  if(!seller)
    return false;

  if(!seller.expiraEm)
    return false;

  return Date.now() <
  seller.expiraEm;
}

function createStoreLink(nome){

  return
`https://t.me/${BOT_USERNAME}?start=loja_${nome}`;
}

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
    match[1]?.trim();

    // =====================================
    // ABRIR LOJA
    // =====================================

    if(
      param &&
      param.startsWith("loja_")
    ){

      const lojaNome =
      param.replace(
        "loja_",
        ""
      );

      const snap =
      await db
      .collection("produtos")
      .where(
        "lojaNome",
        "==",
        lojaNome
      )
      .get();

      if(snap.empty){

        return bot.sendMessage(
          chatId,
          "❌ Loja sem produtos"
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
`buy_${doc.id}`
        }]);

      });

      return bot.sendMessage(
        chatId,

`🛒 LOJA ${lojaNome}

Escolha um produto abaixo 👇`,

{
  reply_markup:{
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

✅ Loja automática
✅ PIX automático
✅ Entrega automática
✅ Painel vendedor
✅ Link personalizado

━━━━━━━━━━━━━━━━━━━

💰 PLANOS DISPONÍVEIS

🧪 TESTE 1 MIN:
R$ 0,01

📦 3 DIAS:
R$ 0,97

📦 7 DIAS:
R$ 1,99

📦 14 DIAS:
R$ 2,60

📦 21 DIAS:
R$ 3,90

📦 30 DIAS:
R$ 5,00

━━━━━━━━━━━━━━━━━━━

👇 Escolha uma opção`
}
    );

    await bot.sendMessage(
      chatId,

`📋 MENU PRINCIPAL`,

{
  reply_markup:{
    inline_keyboard:[

      [
        {
          text:
          "💳 ALUGAR BOT",

          callback_data:
          "alugar_bot"
        }
      ],

      [
        {
          text:
          "♻️ RENOVAR PLANO",

          callback_data:
          "renovar_plano"
        }
      ],

      [
        {
          text:
          "❌ CANCELAR PLANO",

          callback_data:
          "cancelar_plano"
        }
      ],

      [
        {
          text:
          "📦 MEUS PRODUTOS",

          callback_data:
          "meus_produtos"
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

  } catch(err){

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
    // PLANOS
    // =====================================

    if(
      data === "alugar_bot" ||
      data === "renovar_plano"
    ){

      return bot.sendMessage(
        q.message.chat.id,

`💳 ESCOLHA UM PLANO`,

{
  reply_markup:{
    inline_keyboard:[

      [
        {
          text:
          "🧪 TESTE 1MIN - R$0,01",

          callback_data:
          "plan_teste"
        }
      ],

      [
        {
          text:
          "📦 3 DIAS - R$0,97",

          callback_data:
          "plan_plano3"
        }
      ],

      [
        {
          text:
          "📦 7 DIAS - R$1,99",

          callback_data:
          "plan_plano7"
        }
      ],

      [
        {
          text:
          "📦 14 DIAS - R$2,60",

          callback_data:
          "plan_plano14"
        }
      ],

      [
        {
          text:
          "📦 21 DIAS - R$3,90",

          callback_data:
          "plan_plano21"
        }
      ],

      [
        {
          text:
          "📦 30 DIAS - R$5,00",

          callback_data:
          "plan_plano30"
        }
      ]
    ]
  }
}
      );
    }

    // =====================================
    // GERAR PIX PLANO
    // =====================================

    if(
      data.startsWith("plan_")
    ){

      const planId =
      data.replace(
        "plan_",
        ""
      );

      const plano =
      PLANOS[planId];

      if(!plano)
        return;

      // TESTE 1 VEZ

      if(planId === "teste"){

        const testeDoc =
        await db
        .collection("teste")
        .doc(userId)
        .get();

        if(testeDoc.exists){

          return bot.sendMessage(
            q.message.chat.id,

`❌ Você já usou o plano teste`
          );
        }
      }

      const payment =
      await mpPayment.create({

        body:{

          transaction_amount:
          Number(plano.valor),

          description:
          `Plano ${plano.nome}`,

          payment_method_id:
          "pix",

          notification_url:
`${process.env.RENDER_EXTERNAL_URL}/webhook/mp`,

          payer:{
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
      .collection("pagamentos")
      .doc(
        String(payment.id)
      )
      .set({

        tipo:
        "plano",

        planoId:
        planId,

        userId,

        chatId:
        q.message.chat.id,

        aprovado:
        false,

        createdAt:
        Date.now()
      });

      return bot.sendPhoto(
        q.message.chat.id,

        Buffer.from(
          qr,
          "base64"
        ),

{
  caption:

`💳 PAGAMENTO DO PLANO

━━━━━━━━━━━━━━━━━━━

📦 ${plano.nome}

💰 R$ ${plano.valor}

━━━━━━━━━━━━━━━━━━━

📋 PIX COPIA E COLA:

${copia}

━━━━━━━━━━━━━━━━━━━

⏳ Aguardando pagamento...`
}
      );
    }

    // =====================================
    // CANCELAR
    // =====================================

    if(
      data === "cancelar_plano"
    ){

      await db
      .collection("vendedores")
      .doc(userId)
      .delete();

      return bot.sendMessage(
        q.message.chat.id,

`❌ Plano cancelado`
      );
    }

    // =====================================
    // MEUS PRODUTOS
    // =====================================

    if(
      data === "meus_produtos"
    ){

      const planoAtivo =
      await hasPlan(userId);

      if(!planoAtivo){

        return bot.sendMessage(
          q.message.chat.id,

`❌ Você precisa pagar um plano`
        );
      }

      const snap =
      await db
      .collection("produtos")
      .where(
        "owner",
        "==",
        userId
      )
      .get();

      if(snap.empty){

        return bot.sendMessage(
          q.message.chat.id,

`📦 Você não possui produtos`
        );
      }

      let texto =
"📦 SEUS PRODUTOS\n\n";

      snap.forEach(doc => {

        const p =
        doc.data();

        texto +=

`🆔 ${doc.id}

📦 ${p.nome}
💰 R$ ${p.preco}

`;
      });

      return bot.sendMessage(
        q.message.chat.id,
        texto
      );
    }

    // =====================================
    // ADD PRODUTO
    // =====================================

    if(
      data === "add_produto"
    ){

      const planoAtivo =
      await hasPlan(userId);

      if(!planoAtivo){

        return bot.sendMessage(
          q.message.chat.id,

`❌ Você precisa pagar um plano antes de vender`
        );
      }

      userState[userId] = {
        step: "img"
      };

      return bot.sendMessage(
        q.message.chat.id,

`🖼 ENVIE O LINK DA IMAGEM`
      );
    }

    // =====================================
    // BUY PRODUTO
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
      .collection("produtos")
      .doc(idProduto)
      .get();

      if(!doc.exists){

        return bot.sendMessage(
          q.message.chat.id,

`❌ Produto não encontrado`
        );
      }

      const p =
      doc.data();

      const payment =
      await mpPayment.create({

        body:{

          transaction_amount:
          Number(p.preco),

          description:
          p.nome,

          payment_method_id:
          "pix",

          notification_url:
`${process.env.RENDER_EXTERNAL_URL}/webhook/mp`,

          payer:{
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
      .collection("pagamentos")
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

        link:
        p.link,

        aprovado:
        false
      });

      return bot.sendPhoto(
        q.message.chat.id,

        Buffer.from(
          qr,
          "base64"
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

  } catch(err){

    console.log(err);
  }
});

// =========================================
// ADD PRODUTOS
// =========================================

bot.on(
"message",
async (msg) => {

  try {

    if(!msg.text)
      return;

    const id =
    String(msg.from.id);

    const text =
    msg.text;

    const state =
    userState[id];

    if(
      text.startsWith("/")
    ) return;

    if(!state)
      return;

    // IMG

    if(
      state.step === "img"
    ){

      state.img = text;

      state.step =
      "loja";

      return bot.sendMessage(
        msg.chat.id,

`🏪 NOME DA SUA LOJA

Exemplo:
minhaloja`
      );
    }

    // LOJA

    if(
      state.step === "loja"
    ){

      state.loja =
      text
      .toLowerCase()
      .replace(/\s/g,"");

      state.step =
      "vendedor";

      return bot.sendMessage(
        msg.chat.id,

`👤 NOME VENDEDOR`
      );
    }

    // VENDEDOR

    if(
      state.step === "vendedor"
    ){

      state.vendedor =
      text;

      state.step =
      "produto";

      return bot.sendMessage(
        msg.chat.id,

`📦 NOME PRODUTO`
      );
    }

    // PRODUTO

    if(
      state.step === "produto"
    ){

      state.nome =
      text;

      state.step =
      "valor";

      return bot.sendMessage(
        msg.chat.id,

`💰 VALOR`
      );
    }

    // VALOR

    if(
      state.step === "valor"
    ){

      state.preco =
      Number(
        text.replace(",",".")
      );

      state.step =
      "descricao";

      return bot.sendMessage(
        msg.chat.id,

`📝 DESCRIÇÃO`
      );
    }

    // DESC

    if(
      state.step === "descricao"
    ){

      state.desc =
      text;

      state.step =
      "pix";

      return bot.sendMessage(
        msg.chat.id,

`💳 CHAVE PIX`
      );
    }

    // PIX

    if(
      state.step === "pix"
    ){

      state.pix =
      text;

      state.step =
      "whatsapp";

      return bot.sendMessage(
        msg.chat.id,

`📲 WHATSAPP`
      );
    }

    // WHATSAPP

    if(
      state.step === "whatsapp"
    ){

      state.whatsapp =
      text;

      state.step =
      "link";

      return bot.sendMessage(
        msg.chat.id,

`🔗 LINK ENTREGA`
      );
    }

    // LINK

    if(
      state.step === "link"
    ){

      await db
      .collection("produtos")
      .add({

        owner:id,

        lojaNome:
        state.loja,

        vendedor:
        state.vendedor,

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

        img:
        state.img,

        createdAt:
        Date.now()
      });

      const lojaLink =
`https://t.me/${BOT_USERNAME}?start=loja_${state.loja}`;

      userState[id] =
      null;

      return bot.sendMessage(
        msg.chat.id,

`✅ PRODUTO ADICIONADO

━━━━━━━━━━━━━━━━━━━

🏪 Loja:
${state.loja}

📦 Produto:
${state.nome}

💰 Valor:
R$ ${state.preco}

━━━━━━━━━━━━━━━━━━━

🔗 LINK DA SUA LOJA:

${lojaLink}

━━━━━━━━━━━━━━━━━━━

📢 Compartilhe sua loja`
      );
    }

  } catch(err){

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

    const vendaRef =
    db
    .collection("pagamentos")
    .doc(
      String(payment.id)
    );

    const vendaDoc =
    await vendaRef.get();

    if(!vendaDoc.exists)
      return res.sendStatus(200);

    const venda =
    vendaDoc.data();

    if(venda.aprovado)
      return res.sendStatus(200);

    await vendaRef.update({
      aprovado:true
    });

    // =====================================
    // PLANO
    // =====================================

    if(
      venda.tipo === "plano"
    ){

      const plano =
      PLANOS[venda.planoId];

      let expiraEm =
      Date.now();

      if(plano.minutos){

        expiraEm +=
        plano.minutos *
        60 *
        1000;

      } else {

        expiraEm +=
        plano.dias *
        24 *
        60 *
        60 *
        1000;
      }

      await db
      .collection("vendedores")
      .doc(venda.userId)
      .set({

        userId:
        venda.userId,

        plano:
        plano.nome,

        expiraEm,

        createdAt:
        Date.now()
      });

      if(
        venda.planoId ===
        "teste"
      ){

        await db
        .collection("teste")
        .doc(venda.userId)
        .set({
          usado:true
        });
      }

      await bot.sendMessage(
        venda.chatId,

`✅ PLANO ATIVADO

━━━━━━━━━━━━━━━━━━━

📦 ${plano.nome}

⏳ Expira automaticamente

━━━━━━━━━━━━━━━━━━━

🚀 Agora você já pode vender`
      );
    }

    // =====================================
    // PRODUTO
    // =====================================

    if(
      venda.tipo === "produto"
    ){

      await bot.sendMessage(
        venda.chatId,

`✅ PAGAMENTO APROVADO

━━━━━━━━━━━━━━━━━━━

📦 ${venda.produto}

💰 R$ ${venda.valor}

📲 ${venda.whatsapp}

━━━━━━━━━━━━━━━━━━━

🔓 LINK:

${venda.link}`
      );
    }

    res.sendStatus(200);

  } catch(err){

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

  console.log(
    webhook
  );
});
