const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

const connections = [];
const clients = [];

app.use(express.static("public"));

app.get("/", (req, res) => {
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
      io.in(room).emit("userJoined");
      // socket.to(room).emit("userJoined", socket.id);
    } else {
      socket.join(room);
    }
  });

  socket.on('leaveRoom', async (room) => {
    socket.leave(room);
  })

  socket.on("sendMessage", (info) => {
    const parsedInfo = JSON.parse(info);
    // if (!parsedInfo.socketId) {
    //   io.sockets.to(parsedInfo.room).emit("messageFromPeer", info);
    // } else {
    //   io.to(parsedInfo.socketId).emit("messageFromPeer", info);
    // }
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

server.listen(3000, () => {
  console.log("listening on *:3000");
});
