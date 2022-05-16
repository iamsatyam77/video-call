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
          "stun:stun3.l.google.com:19302",
        ],
      },
    ],
  };

  let localStream;
  let remoteStream = {};
  let peerConnection = {};

  const init = async () => {
    try {
      await initializeChannelAndListeners();
      // const devices = await navigator.mediaDevices.enumerateDevices();
      // const videoDevice = devices.filter((device) => device.kind === 'videoinput');
      // console.log(`Media devices are: ${JSON.stringify(devices)}`);
      localStream = await navigator.mediaDevices.getUserMedia(constraints);
      await addUserToDom(socket.id, true);
      document.getElementById(`user-${socket.id}`).srcObject = localStream;
      socket.emit("addRoom", room);
    } catch (error) {
      console.error("Error accessing media devices.", error);
      document.getElementById("no-display").style.display = "flex";
      document.getElementById("display-video").style.display = "none";
    }
  };

  const createPeerConnection = async (socketId) => {
    try {
      peerConnection[socketId] = new RTCPeerConnection(peerConnectionConfig);

      remoteStream[socketId] = new MediaStream();
      await addUserToDom(socketId);
      document.getElementById(`user-${socketId}`).srcObject =
        remoteStream[socketId];
      document.getElementById(`user-${socketId}`).style.display = "block";
      document.getElementById(`user-${socket.id}`).classList.add("smallFrame");

      if (!localStream) {
        localStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        document.getElementById(`user-${socket.id}`).srcObject = localStream;
      }

      localStream.getTracks().forEach((track) => {
        peerConnection[socketId].addTrack(track, localStream);
      });

      peerConnection[socketId].ontrack = async (event) => {
        event.streams[0].getTracks().forEach((track) => {
          remoteStream[socketId].addTrack(track);
        });
        // document.getElementById("user-2").srcObject = event.streams[0];
        document.getElementById("userLeftMessage").style.display = "none";
        document.getElementById("mute-speaker-btn").style.display = "block";
      };

      peerConnection[socketId].onicecandidate = async (event) => {
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

      peerConnection[socketId].onicecandidateerror = async (event) => {
        console.log("ice candidate error", JSON.stringify(event));
      };
    } catch (ex) {
      console.error("Error while calling createPeerConnection", ex);
    }
  };

  const createOffer = async (socketId) => {
    try {
      await createPeerConnection(socketId);

      const offer = await peerConnection[socketId].createOffer();
      await peerConnection[socketId].setLocalDescription(offer);

      console.log("Offer:", offer, socketId);
      socket.emit(
        "sendMessage",
        JSON.stringify({
          room,
          type: "offer",
          offer,
        })
      );
    } catch (ex) {
      console.error("Error while calling createOffer", ex);
    }
  };

  const createAnswer = async (socketId, offer) => {
    try {
      await createPeerConnection(socketId);

      await peerConnection[socketId].setRemoteDescription(
        new RTCSessionDescription(offer)
      );

      const answer = await peerConnection[socketId].createAnswer();
      await peerConnection[socketId].setLocalDescription(answer);

      console.log("Answer:", answer);
      socket.emit(
        "sendMessage",
        JSON.stringify({
          room,
          type: "answer",
          answer,
        })
      );
    } catch (ex) {
      console.error("Error while calling createAnswer", ex);
    }
  };

  const addAnswer = async (answer, socketId) => {
    try {
      if (peerConnection[socketId].currentRemoteDescription === null) {
        await peerConnection[socketId].setRemoteDescription(
          new RTCSessionDescription(answer)
        );
      }
    } catch (ex) {
      console.error("Error while calling addAnswer", ex);
    }
  };

  const handleUserJoined = async (socketId) => {
    console.log(`User with socket Id ${socketId} has joined the room`);
    await createOffer(socketId);
  };

  const handleOnMessageFromPeer = async (message) => {
    try {
      message = JSON.parse(message);
      switch (message.type) {
        case "offer":
          await createAnswer(message.socketId, message.offer);
          break;

        case "candidate":
          if (peerConnection[message.socketId]) {
            peerConnection[message.socketId].addIceCandidate(
              new RTCIceCandidate(message.candidate)
            );
          }
          break;

        case "answer":
          await addAnswer(message.answer, message.socketId);
          break;

        default:
          break;
      }
    } catch (ex) {
      console.error("Error while calling handleOnMessageFromPeer", ex);
    }
  };

  const handleUserLeft = async () => {
    socket.emit("leaveRoom", room);
  };

  const handleUserLeftRoom = async (socketId) => {
    document.getElementById(`user-${socketId}`).remove();
    document.getElementById(`user-${socket.id}`).classList.remove("smallFrame");
    document.getElementById("mute-speaker-btn").style.display = "none";
    document.getElementById("userLeftMessage").style.display = "block";
    document.getElementById("userLeftMessage").innerText =
      "Other member has left this room!";
  };

  const initializeChannelAndListeners = async () => {
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
    // const audioTrack = remoteStream
    //   .getTracks()
    //   .find((track) => track.kind === "audio");
    // if (audioTrack.enabled) {
    //   audioTrack.enabled = false;
    //   document.getElementById("mute-speaker-btn").style.backgroundColor =
    //     "rgb(128, 128, 128)";
    // } else {
    //   audioTrack.enabled = true;
    //   document.getElementById("mute-speaker-btn").style.backgroundColor =
    //     "rgb(65, 105, 225)";
    // }
  };

  const addUserToDom = async (userId, muted = false) => {
    console.log("+++++++++++++++++++++++MUTED++++++++++++++", muted);
    const video = document.createElement("video");
    video.id = `user-${userId}`;
    video.classList.add("video-device");
    video.autoplay = true;
    video.muted = muted;
    video.playsInline = true;
    document.getElementById("video-container").appendChild(video);
  };

  window.addEventListener("beforeunload", handleUserLeft);
  document.getElementById("camera-btn").addEventListener("click", toggleCamera);
  document.getElementById("audio-btn").addEventListener("click", toggleMic);
  document.getElementById("hang-up-btn").addEventListener("click", hangUpCall);
  document
    .getElementById("mute-speaker-btn")
    .addEventListener("click", muteOtherUser);
  document
    .getElementById("back-btn")
    .addEventListener("click", handleOnBackClick);

  init();
}
