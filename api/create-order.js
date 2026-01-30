// /api/create-order.js

import crypto from "crypto";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      platform,
      service,
      quantity,
      usdPrice,
      coin
    } = req.body;

    if (!platform || !service || !quantity || !usdPrice || !coin) {
      return res.status(400).json({ error: "Missing order data" });
    }

    // Generate Order ID
    const orderId = "RR-" + crypto.randomBytes(4).toString("hex").toUpperCase();

    // Map coin → CoinGecko ID
    const COINS = {
      BTC: "bitcoin",
      LTC: "litecoin",
      DOGE: "dogecoin",
      TRX: "tron"
    };

    if (!COINS[coin]) {
      return res.status(400).json({ error: "Unsupported coin" });
    }

    // Fetch live price from CoinGecko
    const priceRes = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${COINS[coin]}&vs_currencies=usd`
    );

    const priceData = await priceRes.json();
    const coinUsdPrice = priceData[COINS[coin]].usd;

    if (!coinUsdPrice) {
      return res.status(500).json({ error: "Price fetch failed" });
    }

    // Convert USD → crypto
    const cryptoAmount = Number((usdPrice / coinUsdPrice).toFixed(8));

    // Wallet address from env
    const ADDRESSES = {
      BTC: process.env.BTC_ADDRESS,
      LTC: process.env.LTC_ADDRESS,
      DOGE: process.env.DOGE_ADDRESS,
      TRX: process.env.TRX_ADDRESS
    };

    const walletAddress = ADDRESSES[coin];

    if (!walletAddress) {
      return res.status(500).json({ error: "Wallet address missing" });
    }

    // Lock price for 30 minutes
    const expiresAt = Date.now() + 30 * 60 * 1000;

    // ⚠️ For now we RETURN order data
    // (In next step we will STORE it)
    return res.status(200).json({
      success: true,
      order: {
        orderId,
        platform,
        service,
        quantity,
        coin,
        usdPrice,
        cryptoAmount,
        walletAddress,
        expiresAt
      }
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
