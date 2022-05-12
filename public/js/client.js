const socket = io();
const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
const room = urlParams.get("room");

if (!room) {
  window.location = "/";
} else {
  const constraints = {
    video: {
      width: { min: 640, ideal: 1920, max: 1920 },
      height: { min: 480, ideal: 1080, max: 1080 },
    },
    audio: true,
  };

  const peerConnectionConfig = {
    iceServers: [
      {
        urls: [
          "stun:stun1.l.google.com:19302",
          "stun:stun2.l.google.com:19302",
        ],
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
      document.getElementById("title").innerText = `You are in Room: ${room}`;
    } catch (error) {
      console.error("Error accessing media devices.", error);
      // document.getElementById("no-display").style.display = "block";
      document.getElementById("display-video").style.display = "none";
    }
  };

  const createPeerConnection = async (socketId) => {
    peerConnection = new RTCPeerConnection(peerConnectionConfig);

    remoteStream = new MediaStream();
    document.getElementById("user-2").srcObject = remoteStream;
    document.getElementById("user-2").style.display = "block";
    document.getElementById("video-container").classList.add("video-devices");
    document
      .getElementById("video-container")
      .classList.remove("video-devices-single");

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
      document.getElementById("userLeftMessage").style.display = "none";
      document.getElementById("mute-speaker-btn").style.display = "block";
    };

    peerConnection.onicecandidate = async (event) => {
      if (event.candidate) {
        console.log("New ICE candidate:", event);
        socket.emit(
          "sendMessage",
          JSON.stringify({
            room,
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
        room,
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
        room,
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

  const handleUserLeft = async () => {
    socket.emit("leaveRoom", room);
    room = null;
  };

  const handleUserLeftRoom = async () => {
    document.getElementById("user-2").style.display = "none";
    document
      .getElementById("video-container")
      .classList.add("video-devices-single");
    document
      .getElementById("video-container")
      .classList.remove("video-devices");
    document.getElementById("mute-speaker-btn").style.display = "none";
    document.getElementById("userLeftMessage").innerText =
      "Other member has left this room, please end this call and join/create other call.";
  };

  const initializeChannelAndListeners = async () => {
    socket.emit("addRoom", room);
    socket.on("userJoined", handleUserJoined);
    socket.on("userleft", handleUserLeft);
    socket.on("userLeftRoom", handleUserLeftRoom);
    socket.on("messageFromPeer", handleOnMessageFromPeer);
  };

  const toggleMic = () => {
    const audioTrack = localStream
      .getTracks()
      .find((track) => track.kind === "audio");

    if (audioTrack.enabled) {
      audioTrack.enabled = false;
      document.getElementById("audio-btn").style.backgroundColor =
        "rgb(128, 128, 128)";
    } else {
      audioTrack.enabled = true;
      document.getElementById("audio-btn").style.backgroundColor =
        "rgb(65, 105, 225)";
    }
  };

  const toggleCamera = () => {
    const videoTrack = localStream
      .getTracks()
      .find((track) => track.kind === "video");

    if (videoTrack.enabled) {
      videoTrack.enabled = false;
      document.getElementById("camera-btn").style.backgroundColor =
        "rgb(128, 128, 128)";
    } else {
      videoTrack.enabled = true;
      document.getElementById("camera-btn").style.backgroundColor =
        "rgb(65, 105, 225)";
    }
  };

  const hangUpCall = () => {
    handleUserLeft();
    window.location = "/";
  };

  const handleOnBackClick = async () => {
    window.location = "/";
  };

  const muteOtherUser = async () => {
    if (document.getElementById("user-2").hasAttribute("muted")) {
      document.getElementById("user-2").removeAttribute("muted");
      document.getElementById("mute-speaker-btn").style.backgroundColor =
        "rgb(65, 105, 225)";
    } else {
      document.getElementById("user-2").muted = true;
      document.getElementById("mute-speaker-btn").style.backgroundColor =
        "rgb(128, 128, 128)";
    }
  };

  window.addEventListener("beforeunload", handleUserLeft);
  document.getElementById("camera-btn").addEventListener("click", toggleCamera);
  document.getElementById("audio-btn").addEventListener("click", toggleMic);
  document.getElementById("hang-up-btn").addEventListener("click", hangUpCall);
  document
    .getElementById("mute-speaker-btn")
    .addEventListener("click", muteOtherUser);
  // document
  //   .getElementById("back-btn")
  //   .addEventListener("click", handleOnBackClick);

  init();
}
