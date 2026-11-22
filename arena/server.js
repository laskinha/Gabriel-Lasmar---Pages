import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { TikTokLiveConnection, WebcastEvent } from "tiktok-live-connector";

const USER = (process.env.TIKTOK_USER || "").replace("@", "");
const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.static("public"));
const server = createServer(app);
const wss = new WebSocketServer({ server });

const send = (o) => {
  const s = JSON.stringify(o);
  wss.clients.forEach((c) => c.readyState === 1 && c.send(s));
};

function start() {
  if (!USER) { console.log("Defina TIKTOK_USER (seu @ sem o @). Rodando só o site/demo."); return; }
  const conn = new TikTokLiveConnection(USER, {});
  // identificador estável por pessoa (nunca aleatório)
  const who = (d) => {
    const u = d.user || {};
    const id = String(u.uniqueId || u.userId || u.nickname || "");
    return {
      id,
      name: u.nickname || u.uniqueId || "anon",
      pic: u.profilePicture?.urls?.[0] || u.profilePicture?.url?.[0] || ""
    };
  };
  const ok = (w) => w.id !== "" && w.id !== "0";
  conn.on(WebcastEvent.CHAT, (d) => { const w = who(d); if (ok(w)) send({ t: "chat", ...w, text: d.comment || "" }); });
  conn.on(WebcastEvent.LIKE, (d) => { const w = who(d); if (ok(w)) send({ t: "like", ...w, n: d.likeCount || 1 }); });
  conn.on(WebcastEvent.GIFT, (d) => {
    const w = who(d); if (!ok(w)) return;
    const gd = d.giftDetails || {};
    // presentes em sequência só contam quando terminam
    if (gd.giftType === 1 && !d.repeatEnd) return;
    const coins = Math.max(1, (gd.diamondCount || d.diamondCount || 1) * (d.repeatCount || 1));
    send({ t: "gift", ...w, coins, gift: gd.giftName || d.giftName || "" });
  });
  conn.on(WebcastEvent.FOLLOW, (d) => { const w = who(d); if (ok(w)) send({ t: "follow", ...w }); });
  conn.on(WebcastEvent.SHARE, (d) => { const w = who(d); if (ok(w)) send({ t: "share", ...w }); });
  const go = () => conn.connect()
    .then(() => console.log("Conectado na live de @" + USER))
    .catch((e) => { console.log("Aguardando a live (@" + USER + " ainda não está ao vivo?)", e?.message || e); setTimeout(go, 15000); });
  conn.on("disconnected", () => setTimeout(go, 5000));
  go();
}
start();
server.listen(PORT, () => console.log("Arena em http://localhost:" + PORT));
