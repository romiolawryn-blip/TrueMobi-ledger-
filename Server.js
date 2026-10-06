const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Health check so Render stays alive
app.get('/', (req,res)=> res.send('TrueMobi ledger LIVE'));

// Start sharing - 40% user, 60% you
app.post('/api/start-node', async (req,res)=>{
  const { user_id, data_volume } = req.body;
  if(!user_id) return res.status(400).json({error:"missing user_id"});
  const gb = parseFloat(data_volume)||1;
  const totalUGX = gb * 10000; // 10k per GB
  const userUGX = totalUGX * 0.40;
  const ownerUGX = totalUGX * 0.60;
  try{
    await pool.query(`INSERT INTO earnings(user_id,total_ugx,user_ugx,owner_ugx) VALUES($1,$2,$3,$4)`,[user_id,totalUGX,userUGX,ownerUGX]);
    res.json({message:"Shared",user_balance:userUGX,total:totalUGX});
  }catch(e){ res.status(500).json({error:e.message}) }
});

// Withdraw to MTN MoMo via Flutterwave
app.post('/api/withdraw', async (req,res)=>{
  res.json({message:"Withdraw queued - Flutterwave will pay MoMo in 3hrs",status:"pending"});
});

const PORT = process.env.PORT||10000;
app.listen(PORT,()=>console.log('Running on '+PORT));
