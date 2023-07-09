let localStream = null;
let remoteStream = null;
let localVideo = document.getElementById("localVideo");
let remoteVideo = document.getElementById("remoteVideo");
let peerConnection;
var socket = io("https://15.207.180.128:3030", {
  transports: ["websocket"],
});
let serverConfig = {
  iceServers: [
    {
      urls: "stun:stun1.1.google.com:19302",
    },
    {
      urls: "stun:stun2.2.google.com:19302",
    },
  ],
};
const urlParams = new URLSearchParams(window.location.search);
let name = urlParams.get('name');
let pendingIceCandidates = [];

document.addEventListener("DOMContentLoaded", () => {
  async function init() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      localStream = stream;
      localVideo.srcObject = stream;
      createOffer();
    } catch (error) {
      console.log(error);
    }
  }

  let createOffer = async () => {
    peerConnection = new RTCPeerConnection(serverConfig);
    remoteStream = new MediaStream();
    remoteVideo.srcObject = remoteStream;
    localStream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localStream);
    });

    peerConnection.ontrack = async (event) => {
      event.streams[0].getTracks().forEach((track) => {
        remoteStream.addTrack(track);
      });
    };

    peerConnection.onicecandidate = async (event) => {
      if (event.candidate) {
        socket.emit("iceCandidate", event.candidate);
      }
    };

    socket.on("iceCandidate", async (candidate) => {
      if (peerConnection.currentRemoteDescription) {
        try {
          await peerConnection.addIceCandidate(candidate);
          console.log("ICE candidate added successfully");
        } catch (error) {
          console.error("Error adding ICE candidate:", error);
        }
      } else {
        pendingIceCandidates.push(candidate);
      }
    });

    let offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    if (!offer) return alert("Please create offer first");

    socket.emit("create-offer", offer);

    // Listen for the remote offer and set it as the remote description
    socket.on("create-answer", async (offer) => {
      if (!offer) return alert("Please create offer first");

      await peerConnection.setRemoteDescription(offer);

      // Create an answer and set it as the local description
      let answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      // Send the answer to the remote peer
      socket.emit("get-answer", answer);
    });

    // Listen for the remote answer and add it to the peer connection
    socket.on("set-answer", async (answer) => {
      if (!answer) return alert("Please create answer first");

      await peerConnection.setRemoteDescription(answer);

      // Add any pending ice candidates to the peer connection
      pendingIceCandidates.forEach(async (candidate) => {
        try {
          await peerConnection.addIceCandidate(candidate);
          console.log("ICE candidate added successfully");
        } catch (error) {
          console.error("Error adding ICE candidate:", error);
        }
      });
      pendingIceCandidates = [];
    });
  };
  document.getElementById("muteAudio").addEventListener("click", () => {
    localStream.getAudioTracks()[0].enabled = !localStream.getAudioTracks()[0]
      .enabled;
      document.getElementById("muteAudio").style.color = localStream.getAudioTracks()[0].enabled ? "black" : "red";
  });
  document.getElementById("muteVideo").addEventListener("click", () => {
    localStream.getVideoTracks()[0].enabled = !localStream.getVideoTracks()[0]
      .enabled;
      document.getElementById("muteVideo").style.color = localStream.getVideoTracks()[0].enabled ? "black" : "red";
  });
  document.getElementById("hangup").addEventListener("click", () => {
    localStream.getTracks().forEach((track) => {
      track.stop();
    });
    remoteStream.getTracks().forEach((track) => {
      track.stop();
    });
    localVideo.srcObject = null;
    remoteVideo.srcObject = null;
    peerConnection.close();
    peerConnection = null;
    socket.disconnect();
    window.location.href = "index.html";
  });
  function startScreenSharing() {
    let constraints = {
      audio: false,
      video: {
        // Specify the resolution of the screen share
        width: 640,
        height: 480,
      },
    };
  
    // Start screen sharing
    navigator.mediaDevices.getDisplayMedia(constraints).then((stream) => {
      // Add the screen share stream to the remoteVideo element
      remoteVideo.srcObject = stream;
  
      // Listen for the end of the screen share
      stream.getTracks()[0].onended = function () {
        // Remove the screen share stream from the remoteVideo element
        remoteVideo.srcObject = null;
      };
    });
  }
  
  document.getElementById("shareScreen").addEventListener("click",
  () => {
    navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
    }).then((stream) => {
      let videoTrack = stream.getVideoTracks()[0];
      let sender = peerConnection.getSenders().find((s) => {
        return s.track.kind == videoTrack.kind;
      });
      sender.replaceTrack(videoTrack);
      localVideo.srcObject = stream;
      stream.getTracks()[0].onended = function () {
        let videoTrack = localStream.getVideoTracks()[0];
        let sender = peerConnection.getSenders().find((s) => {

          return s.track.kind == videoTrack.kind;
        });
        sender.replaceTrack(videoTrack);
        localVideo.srcObject = localStream;
      };
    });
  });

  init();
});
