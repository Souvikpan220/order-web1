// /api/verify-payment.js

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { order, txid } = req.body;

    if (!order || !txid) {
      return res.status(400).json({ error: "Missing order or txid" });
    }

    const {
      orderId,
      platform,
      service,
      quantity,
      coin,
      usdPrice,
      cryptoAmount,
      walletAddress
    } = order;

    let txData, receivedAmount = 0, confirmations = 0;

    /* =========================
       COIN-SPECIFIC VERIFICATION
       ========================= */

    // -------- BTC --------
    if (coin === "BTC") {
      const r = await fetch(`https://blockstream.info/api/tx/${txid}`);
      txData = await r.json();

      confirmations = txData.status.confirmed ? 2 : 0;

      txData.vout.forEach(v => {
        if (v.scriptpubkey_address === walletAddress) {
          receivedAmount += v.value / 1e8;
        }
      });
    }

    // -------- LTC --------
    if (coin === "LTC") {
      const r = await fetch(`https://sochain.com/api/v2/get_tx/LTC/${txid}`);
      const d = await r.json();

      confirmations = d.data.confirmations;
      d.data.outputs.forEach(o => {
        if (o.address === walletAddress) {
          receivedAmount += Number(o.value);
        }
      });
    }

    // -------- DOGE --------
    if (coin === "DOGE") {
      const r = await fetch(`https://sochain.com/api/v2/get_tx/DOGE/${txid}`);
      const d = await r.json();

      confirmations = d.data.confirmations;
      d.data.outputs.forEach(o => {
        if (o.address === walletAddress) {
          receivedAmount += Number(o.value);
        }
      });
    }

    // -------- TRX --------
    if (coin === "TRX") {
      const r = await fetch(`https://apilist.tronscan.org/api/transaction-info?hash=${txid}`);
      const d = await r.json();

      confirmations = d.confirmations || 0;

      if (d.toAddress === walletAddress) {
        receivedAmount = d.contractData.amount / 1e6;
      }
    }

    /* =========================
       VALIDATION RULES
       ========================= */

    const tolerance = cryptoAmount * 0.95;

    const MIN_CONFIRMATIONS = {
      BTC: 2,
      LTC: 2,
      DOGE: 5,
      TRX: 1
    };

    if (confirmations < MIN_CONFIRMATIONS[coin]) {
      return res.status(400).json({ error: "Not enough confirmations" });
    }

    if (receivedAmount < tolerance) {
      return res.status(400).json({ error: "Insufficient payment amount" });
    }

    /* =========================
       SEND TO DISCORD
       ========================= */

    const discordMessage = {
      content:
`🟢 **NEW PAID ORDER (CRYPTO)**

🆔 Order ID: ${orderId}
📱 Platform: ${platform}
⚙️ Service: ${service}
🔢 Quantity: ${quantity}

💰 Payment:
• Coin: ${coin}
• Amount: ${receivedAmount.toFixed(8)}
• USD Value: $${usdPrice}

🔗 Content Link:
${order.contentLink || "N/A"}

👤 Profile Link:
${order.profileLink || "N/A"}

🧾 TXID:
${txid}`
    };

    await fetch(process.env.DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(discordMessage)
    });

    /* =========================
       SUCCESS → REDIRECT
       ========================= */

    return res.status(200).json({
      success: true,
      redirect: "https://yashkaddu.com"
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Verification failed" });
  }
}
