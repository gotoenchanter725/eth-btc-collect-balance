const Pusher = require("pusher");

const pusher = new Pusher({
  appId: "1546350",
  key: "2e80de2d839c97723422",
  secret: "b6abc059a0cc4bd52ca8",
  cluster: "mt1",
  useTLS: true
});

module.exports = { pusher };