const express = require("express");
const cors = require("cors");
const { MongoClient } = require("mongodb");

const app = express();

const PORT = process.env.PORT || 10000;

// 🔥 MONGO
const uri = process.env.MONGO_URI;

const client = new MongoClient(uri);

let db = null;

// 🔥 MIDDLEWARES
app.use(cors());

app.use(express.json());

app.use(express.static("public"));

// 🔥 CONECTAR MONGO
async function conectarMongo(){

  try{

    await client.connect();

    db = client.db("rotas");

    console.log("✅ Mongo conectado");

  }catch(err){

    console.log(err);

  }

}

conectarMongo();

// 🔥 HOME
app.get("/", (req,res)=>{

  res.sendFile(__dirname + "/public/index.html");

});

// 🔥 LISTAR REGISTROS
app.get("/registros", async (req,res)=>{

  try{

    if(!db){

      return res.status(500).json({
        erro:"Banco não conectado"
      });

    }

    const dados = await db
      .collection("registros")
      .find()
      .toArray();

    res.json(dados);

  }catch(err){

    console.log(err);

    res.status(500).json({
      erro:"Erro ao buscar"
    });

  }

});

// 🔥 SALVAR REGISTROS
app.post("/registro", async (req,res)=>{

  try{

    if(!db){

      return res.status(500).json({
        erro:"Banco não conectado"
      });

    }

    const collection =
      db.collection("registros");

    const dados =
      req.body.dados || [];

    if(dados.length === 0){

      return res.status(400).json({
        erro:"Nenhum dado"
      });

    }

    // 🔥 PEGA O MÊS
    const mes =
      dados[0].data.substring(0,7);

    // 🔥 REMOVE APENAS O MÊS ATUAL
    await collection.deleteMany({

      data:{
        $regex:`^${mes}`
      }

    });

    // 🔥 INSERE NOVAMENTE
    await collection.insertMany(dados);

    res.json({
      ok:true
    });

  }catch(err){

    console.log(err);

    res.status(500).json({
      erro:"Erro ao salvar"
    });

  }

});

// 🔥 SERVIDOR
app.listen(PORT, ()=>{

  console.log(
    `🚀 Servidor rodando porta ${PORT}`
  );

});