require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const admin = require('firebase-admin');
const express = require('express');

const app = express();
app.use(express.json());

// CONFIG
const ADMIN_ID = "6863505946";
const BOT_USERNAME = "SellForge_bot";

// FIREBASE
const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// BOT
const bot = new TelegramBot(process.env.BOT_TOKEN);

// WEBHOOK
const SECRET_PATH = `/bot${process.env.BOT_TOKEN}`;
bot.setWebHook(`${process.env.RENDER_EXTERNAL_URL}${SECRET_PATH}`);

app.post(SECRET_PATH, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

app.get('/', (req, res) => res.send(" ONLINE"));

// CONTROLE
const userState = {};
const startTime = Date.now();

/* =============================
 SALVAR USER
============================= */
async function salvarUser(msg) {
  const id = String(msg.from.id);
  const ref = db.collection('users').doc(id);
  const doc = await ref.get();

  if (!doc.exists) {
    await ref.set({
      id,
      nome: msg.from.first_name || "User",
      aprovado: false,
      criadoEm: new Date()
    });
  }
}

/* =============================
 START
============================= */
bot.onText(/\/start$/, async (msg) => {

  const id = String(msg.from.id);
  await salvarUser(msg);

  await bot.sendPhoto(msg.chat.id, "https://i.postimg.cc/Y9FHz03z/logo.jpg");

  await bot.sendMessage(msg.chat.id,
` BEM-VINDO AO SELLFORGE BOT 

 @${BOT_USERNAME}

Automação profissional de vendas `);

  const doc = await db.collection('users').doc(id).get();
  const user = doc.data();

  if (id == ADMIN_ID) return menuAdmin(msg);
  if (user.aprovado) return menuVendedor(msg);
  return menuCliente(msg);
});

/* =============================
 START LINK
============================= */
bot.onText(/\/start (.+)/, async (msg, match) => {

  const vendedorId = match[1];

  const snap = await db.collection('produtos')
    .doc(vendedorId)
    .collection('itens')
    .get();

  if (snap.empty) return bot.sendMessage(msg.chat.id, " Nenhum produto");

  snap.forEach(doc => {
    const p = doc.data();

    bot.sendPhoto(msg.chat.id, p.foto, {
      caption: ` ${p.nome}\n ${p.preco}\n${p.descricao}`,
      reply_markup: {
        inline_keyboard: [[{ text: " Comprar", url: p.link }]]
      }
    });
  });
});

/* =============================
 MENUS
============================= */

function menuCliente(msg) {
  bot.sendMessage(msg.chat.id,
` MENU CLIENTE

/ver ID
/status
/denunciar ID`);
}

function menuVendedor(msg) {
  bot.sendMessage(msg.chat.id,
` MENU VENDEDOR

/addproduto
/produtos
/deletar ID
/deletartodos
/alterar ID
/alterarimg ID
/clientes
/link
/plano
/cancelarplano
/staff
/reembolso`);
}

function menuAdmin(msg) {
  bot.sendMessage(msg.chat.id,
` MENU ADMIN

/aprovar ID
/bloquear ID
/desbloquear ID
/ban ID
/verusuarios
/deleteproduto USERID PRODUTOID
/status`);
}

/* =============================
 COMANDOS
============================= */

// LINK
bot.onText(/\/link/, (msg) => {
  bot.sendMessage(msg.chat.id,
` https://t.me/${BOT_USERNAME}?start=${msg.from.id}`);
});

// ADD PRODUTO
bot.onText(/\/addproduto/, (msg) => {
  userState[msg.from.id] = { step: "foto" };
  bot.sendMessage(msg.chat.id, " Envie a foto");
});

// LISTAR
bot.onText(/\/produtos/, async (msg) => {

  const snap = await db.collection('produtos')
    .doc(String(msg.from.id))
    .collection('itens')
    .get();

  if (snap.empty) return bot.sendMessage(msg.chat.id, " Nenhum produto");

  snap.forEach(doc => {
    const p = doc.data();

    bot.sendMessage(msg.chat.id, ` ID: ${doc.id}`);

    bot.sendPhoto(msg.chat.id, p.foto, {
      caption: `${p.nome} - ${p.preco}`
    });
  });
});

// DELETAR
bot.onText(/\/deletar (.+)/, async (msg, m) => {

  await db.collection('produtos')
    .doc(String(msg.from.id))
    .collection('itens')
    .doc(m[1])
    .delete();

  bot.sendMessage(msg.chat.id, " Deletado");
});

// DELETAR TODOS
bot.onText(/\/deletartodos/, async (msg) => {

  const snap = await db.collection('produtos')
    .doc(String(msg.from.id))
    .collection('itens')
    .get();

  const batch = db.batch();

  snap.forEach(doc => batch.delete(doc.ref));
  await batch.commit();

  bot.sendMessage(msg.chat.id, " Tudo deletado");
});

// ALTERAR PRODUTO
bot.onText(/\/alterar (.+)/, (msg, m) => {
  userState[msg.from.id] = { step: "alterar", id: m[1] };
  bot.sendMessage(msg.chat.id, "Envie:\nnome | preco | descricao | link");
});

// ALTERAR IMG
bot.onText(/\/alterarimg (.+)/, (msg, m) => {
  userState[msg.from.id] = { step: "alterarimg", id: m[1] };
  bot.sendMessage(msg.chat.id, " Envie nova imagem");
});

// VER PRODUTOS CLIENTE
bot.onText(/\/ver (.+)/, async (msg, m) => {

  const snap = await db.collection('produtos')
    .doc(m[1])
    .collection('itens')
    .get();

  if (snap.empty) return bot.sendMessage(msg.chat.id, " Nenhum");

  snap.forEach(doc => {
    const p = doc.data();

    bot.sendPhoto(msg.chat.id, p.foto, {
      caption: `${p.nome}\n ${p.preco}`,
      reply_markup: {
        inline_keyboard: [[{ text: " Comprar", url: p.link }]]
      }
    });
  });
});

// CLIENTES
bot.onText(/\/clientes/, async (msg) => {

  const snap = await db.collection('users').get();

  bot.sendMessage(msg.chat.id, ` Total: ${snap.size}`);
});

// PLANO
bot.onText(/\/plano/, async (msg) => {

  const doc = await db.collection('users').doc(String(msg.from.id)).get();
  const user = doc.data();

  bot.sendMessage(msg.chat.id,
` Status: ${user.aprovado ? "ATIVO" : "INATIVO"}`);
});

// CANCELAR
bot.onText(/\/cancelarplano/, async (msg) => {

  await db.collection('users')
    .doc(String(msg.from.id))
    .update({ aprovado: false });

  bot.sendMessage(msg.chat.id, " Plano cancelado");
});

// STAFF
bot.onText(/\/staff/, (msg) => {
  bot.sendMessage(msg.chat.id,
"https://wa.me/5551981528372");
});

// REEMBOLSO
bot.onText(/\/reembolso/, (msg) => {
  bot.sendMessage(msg.chat.id,
"https://wa.me/5551981528372");
});

// DENUNCIA
bot.onText(/\/denunciar (.+)/, async (msg, m) => {

  await db.collection('denuncias').add({
    alvo: m[1],
    user: msg.from.id,
    data: new Date()
  });

  bot.sendMessage(msg.chat.id, " Denúncia enviada");
});

/* =============================
 ADMIN
============================= */

bot.onText(/\/aprovar (.+)/, async (msg, m) => {
  if (msg.from.id != ADMIN_ID) return;

  await db.collection('users').doc(m[1]).update({ aprovado: true });
  bot.sendMessage(msg.chat.id, " Aprovado");
});

bot.onText(/\/bloquear (.+)/, async (msg, m) => {
  if (msg.from.id != ADMIN_ID) return;

  await db.collection('users').doc(m[1]).update({ aprovado: false });
  bot.sendMessage(msg.chat.id, " Bloqueado");
});

bot.onText(/\/desbloquear (.+)/, async (msg, m) => {
  if (msg.from.id != ADMIN_ID) return;

  await db.collection('users').doc(m[1]).update({ aprovado: true });
  bot.sendMessage(msg.chat.id, " Liberado");
});

bot.onText(/\/ban (.+)/, async (msg, m) => {
  if (msg.from.id != ADMIN_ID) return;

  await db.collection('users').doc(m[1]).delete();
  bot.sendMessage(msg.chat.id, " Banido");
});

bot.onText(/\/deleteproduto (.+) (.+)/, async (msg, m) => {
  if (msg.from.id != ADMIN_ID) return;

  await db.collection('produtos')
    .doc(m[1])
    .collection('itens')
    .doc(m[2])
    .delete();

  bot.sendMessage(msg.chat.id, " Removido");
});

bot.onText(/\/verusuarios/, async (msg) => {
  if (msg.from.id != ADMIN_ID) return;

  const snap = await db.collection('users').get();
  bot.sendMessage(msg.chat.id, ` ${snap.size} usuários`);
});

/* =============================
 STATUS
============================= */

bot.onText(/\/status/, (msg) => {

  const uptime = Math.floor((Date.now() - startTime) / 1000);

  bot.sendMessage(msg.chat.id,
` STATUS
 ${uptime}s
 VIP`);
});

/* =============================
 MESSAGE (ÚNICO)
============================= */

bot.on('message', async (msg) => {

  try {
    if (!msg.from) return;
    if (msg.text && msg.text.startsWith("/")) return;

    const id = String(msg.from.id);
    const state = userState[id];
    const text = msg.text?.toLowerCase();

    // FOTO
    if (state?.step === "foto" && msg.photo) {
      state.foto = msg.photo[msg.photo.length - 1].file_id;
      state.step = "dados";
      return bot.sendMessage(msg.chat.id, "Envie:\nnome | preco | descricao | link");
    }

    // CRIAR PRODUTO
    if (state?.step === "dados" && msg.text?.includes("|")) {

      const [nome, preco, descricao, link] = msg.text.split("|");

      await db.collection('produtos')
        .doc(id)
        .collection('itens')
        .add({
          nome: nome.trim(),
          preco: preco.trim(),
          descricao: descricao.trim(),
          link: link.trim(),
          foto: state.foto
        });

      userState[id] = null;

      return bot.sendMessage(msg.chat.id, " Produto cadastrado!");
    }

    // ALTERAR
    if (state?.step === "alterar" && msg.text?.includes("|")) {

      const [nome, preco, descricao, link] = msg.text.split("|");

      await db.collection('produtos')
        .doc(id)
        .collection('itens')
        .doc(state.id)
        .update({
          nome: nome.trim(),
          preco: preco.trim(),
          descricao: descricao.trim(),
          link: link.trim()
        });

      userState[id] = null;

      return bot.sendMessage(msg.chat.id, " Atualizado!");
    }

    // ALTERAR IMG
    if (state?.step === "alterarimg" && msg.photo) {

      await db.collection('produtos')
        .doc(id)
        .collection('itens')
        .doc(state.id)
        .update({
          foto: msg.photo[msg.photo.length - 1].file_id
        });

      userState[id] = null;

      return bot.sendMessage(msg.chat.id, " Atualizado!");
    }

    // AUTO RESPOSTA
    if (text?.includes("preço") || text?.includes("valor")) {
      return bot.sendMessage(msg.chat.id, " A partir de R$25");
    }

    if (text?.includes("comprar")) {
      return bot.sendMessage(msg.chat.id,
" Clique no
