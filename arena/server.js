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
  const conn = new TikTokLiveConnection(USER);
  const who = (d) => ({
    id: String(d.user?.userId ?? d.userId ?? d.user?.uniqueId ?? Math.random()),
    name: d.user?.nickname || d.user?.uniqueId || "anon",
    pic: d.user?.profilePicture?.url?.[0] || d.user?.profilePicture?.urls?.[0] || ""
  });
  conn.on(WebcastEvent.CHAT, (d) => send({ t: "chat", ...who(d), text: d.comment || "" }));
  conn.on(WebcastEvent.LIKE, (d) => send({ t: "like", ...who(d), n: d.likeCount || 1 }));
  conn.on(WebcastEvent.GIFT, (d) => {
    // presentes em sequência só contam quando terminam
    if (d.giftType === 1 && !d.repeatEnd) return;
    const coins = (d.giftDetails?.diamondCount ?? d.diamondCount ?? 1) * (d.repeatCount || 1);
    send({ t: "gift", ...who(d), coins, gift: d.giftName || d.giftDetails?.giftName || "" });
  });
  conn.on(WebcastEvent.FOLLOW, (d) => send({ t: "follow", ...who(d) }));
  conn.on(WebcastEvent.SHARE, (d) => send({ t: "share", ...who(d) }));
  const go = () => conn.connect()
    .then(() => console.log("Conectado na live de @" + USER))
    .catch((e) => { console.log("Aguardando a live (@" + USER + " ainda não está ao vivo?)", e?.message || e); setTimeout(go, 15000); });
  conn.on("disconnected", () => setTimeout(go, 5000));
  go();
}
start();
server.listen(PORT, () => console.log("Arena em http://localhost:" + PORT));
