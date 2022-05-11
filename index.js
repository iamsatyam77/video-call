const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

const connections = [];
const clients = [];
const PORT = process.env.PORT || 5000;

app.use(express.static("public"));

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/html/lobby.html");
});

app.get("/index", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

io.on("connection", (socket) => {
  console.log("a user connected", socket.id);
  connections.push(socket);
  clients.push({ socketId: socket.id });
  console.log("Connected: %s sockets connected ", connections.length);

  socket.on("addRoom", async (room) => {
    const clients = io.sockets.adapter.rooms.get(room);
    const numClients = typeof clients !== "undefined" ? clients.size : 0;
    if (numClients > 1) {
      console.log("already_full");
    } else if (numClients === 1) {
      socket.join(room);
      socket.broadcast.to(room).emit("userJoined");
    } else {
      socket.join(room);
    }
  });

  socket.on("leaveRoom", async (room) => {
    socket.leave(room);
    socket.broadcast.to(room).emit("userLeftRoom");
  });

  socket.on("sendMessage", (info) => {
    const parsedInfo = JSON.parse(info);
    socket.to(parsedInfo.room).emit("messageFromPeer", info);
  });

  socket.on("disconnect", () => {
    connections.splice(connections.indexOf(socket), 1);
    console.log("Disconnected: %s sockets connected, ", connections.length);
    clients.forEach((client, i) => {
      if (client.socketId === socket.id) {
        clients.splice(i, 1);
      }
    });
  });
});

server.listen(PORT, () => {
  console.log(`listening on PORT:${PORT}`);
});
