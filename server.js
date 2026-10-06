const express = require('express');
const { Pool } = require('pg');
const fetch = require('node-fetch');
const app = express();

app.use(express.json());

// Secure connection to your online Postgres database vault
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// 1. THE STEALTH BACKGROUND TRAFFIC CONNECTOR
app.post('/api/start-node', async (req, res) => {
  const { user_id, data_volume } = req.body;
  
  if (!user_id || !data_volume) {
    return res.status(400).json({ error: "Missing tracking transmission parameters." });
  }

  try {
    const buyers = [
      { name: "Pawns", url: "https://pawns.app", key: process.env.PAWNS_PARTNER_KEY },
      { name: "Honeygain", url: "https://honeygain.com", key: process.env.HONEYGAIN_KEY },
      { name: "PacketStream", url: "https://packetstream.io", key: process.env.PACKETSTREAM_KEY },
      { name: "EarnApp", url: "https://earnapp.com", key: process.env.EARNAPP_KEY },
      { name: "Repocket", url: "https://repocket.co", key: process.env.REPOCKET_KEY }
    ];

    for (let buyer of buyers) {
      if (buyer.key) {
        await fetch(buyer.url, {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${buyer.key}`,
            'Content-Type': 'application/json' 
          },
          body: JSON.stringify({ subid: user_id, bytes: data_volume * 1073741824 })
        }).catch(err => console.log(`Routing lag to ${buyer.name}:`, err.message));
      }
    }

    // Exact Core Math: 10,000 UGX Total Pool Value per shared GB.
    // 40% User cut (4,000 UGX) | 60% Your Master Founder Cut (6,000 UGX)
    const totalPoolValuePerGb = 10000;
    const userEarnings = data_volume * totalPoolValuePerGb * 0.40; 
    const founderProfit = data_volume * totalPoolValuePerGb * 0.60;

    await pool.query('BEGIN');
    await pool.query(
      'INSERT INTO user_wallets(user_id, balance, gb_total) VALUES(\$1, \$2, \$3) ON CONFLICT(user_id) DO UPDATE SET balance = user_wallets.balance + \$2, gb_total = user_wallets.gb_total + \$3',
      [user_id, userEarnings, data_volume]
    );
    await pool.query(
      'INSERT INTO founder_vault(source_user, profit_amount) VALUES(\$1, \$2)',
      [user_id, founderProfit]
    );
    await pool.query('COMMIT');

    res.json({ success: true, user_received: userEarnings, founder_secured: founderProfit });

  } catch (err) {
    await pool.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: "Data pipeline calculation failure." });
  }
});

// 2. PAYOUT QUEUE FOR THE AUTOMATED 3-HOUR PROCESS
app.post('/api/payout', async (req, res) => {
  const { user_id, momo_number, amount } = req.body;
  const payoutAmount = parseInt(amount);

  if (!momo_number || payoutAmount < 20000) {
    return res.status(400).json({ error: "Minimum automated withdrawal is 20,000 UGX" });
  }

  try {
    await pool.query('BEGIN');

    const checkWallet = await pool.query('SELECT balance FROM user_wallets WHERE user_id = \$1 FOR UPDATE', [user_id]);

    if (checkWallet.rows.length === 0 || checkWallet.rows[0].balance < payoutAmount) {
      await pool.query('ROLLBACK');
      return res.status(400).json({ error: "Insufficient account balance." });
    }

    await pool.query('UPDATE user_wallets SET balance = balance - \$1 WHERE user_id = \$2', [payoutAmount, user_id]);
    await pool.query(
      'INSERT INTO payout_requests(user_id, momo_number, amount, status) VALUES(\$1, \$2, \$3, \'pending\')',
      [user_id, momo_number, payoutAmount]
    );

    await pool.query('COMMIT');
    res.json({ success: true, status: 'pending' });

  } catch (err) {
    await pool.query('ROLLBACK');
    res.status(500).json({ error: "Internal ledger processing failure." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`TrueMobile Engine running active on port ${PORT}`));
