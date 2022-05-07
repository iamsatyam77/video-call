const socket = io();

const constraints = {
  video: true,
  audio: true,
};

const peerConnectionConfig = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
  ],
};

let localStream;
let remoteStream;
let peerConnection;

const init = async () => {
  try {
    await initializeChannelAndListeners();

    // const devices = await navigator.mediaDevices.enumerateDevices();
    // const videoDevice = devices.filter((device) => device.kind === 'videoinput');
    // console.log(`Media devices are: ${JSON.stringify(devices)}`);
    localStream = await navigator.mediaDevices.getUserMedia(constraints);
    document.getElementById("user-1").srcObject = localStream;
  } catch (error) {
    console.error("Error accessing media devices.", error);
  }
};

const createPeerConnection = async (socketId) => {
  peerConnection = new RTCPeerConnection(peerConnectionConfig);

  remoteStream = new MediaStream();
  document.getElementById("user-2").srcObject = remoteStream;
  if (!localStream) {
    localStream = await navigator.mediaDevices.getUserMedia(constraints);
    document.getElementById("user-1").srcObject = localStream;
  }

  localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.ontrack = async (event) => {
    event.streams[0].getTracks().forEach((track) => {
      remoteStream.addTrack(track);
    });
    // document.getElementById("user-2").srcObject = event.streams[0];
  };

  peerConnection.onicecandidate = async (event) => {
    if (event.candidate) {
      console.log("New ICE candidate:", event);
      socket.emit(
        "sendMessage",
        JSON.stringify({
          // socketId,
          room: "main",
          type: "candidate",
          candidate: event.candidate,
        })
      );
    }
  };

  peerConnection.onicecandidateerror = async (event) => {
    console.log("ice candidate error", JSON.stringify(event));
  };
};

const createOffer = async (socketId) => {
  await createPeerConnection(socketId);

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  console.log("Offer:", offer, socket.id, socketId);
  socket.emit(
    "sendMessage",
    JSON.stringify({
      // socketId: socketId,
      room: "main",
      type: "offer",
      offer,
    })
  );
};

const createAnswer = async (socketId, offer) => {
  await createPeerConnection(socketId);

  await peerConnection.setRemoteDescription(offer);

  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  console.log("Answer:", answer);
  socket.emit(
    "sendMessage",
    JSON.stringify({
      // socketId: socketId,
      room: "main",
      type: "answer",
      answer,
    })
  );
};

const addAnswer = async (answer) => {
  if (!peerConnection.currentRemoteDescription) {
    peerConnection.setRemoteDescription(answer);
  }
};

const handleUserJoined = async (socketId) => {
  console.log(`User with socket Id ${socketId} has joined the room`);
  await createOffer(socketId);
};

const handleOnMessageFromPeer = async (message) => {
  message = JSON.parse(message);
  console.log(message);

  switch (message.type) {
    case "offer":
      await createAnswer(message.socketId, message.offer);
      break;

    case "candidate":
      if (peerConnection) {
        peerConnection.addIceCandidate(message.candidate);
      }
      break;

    case "answer":
      await addAnswer(message.answer);
      break;

    default:
      break;
  }
};

const handleUserLeft = async (event) => {
  socket.emit("leaveRoom", "main");
};

const initializeChannelAndListeners = async () => {
  socket.emit("addRoom", "main");
  socket.on("userJoined", handleUserJoined);
  socket.on("userleft", handleUserLeft);
  socket.on("messageFromPeer", handleOnMessageFromPeer);
};

window.addEventListener("beforeunload", handleUserLeft);

init();
