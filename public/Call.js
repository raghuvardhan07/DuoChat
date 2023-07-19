// Call.js

let APP_ID = "fcc3eec1f13a4294a61902e446b2588b";

let uid = document.getElementById('user-1').dataset.uid;
let theyid = document.getElementById('user-1').dataset.theyid;
let token = null;

let client;
let channel;

let localStream;
let remoteStream;
let peerConnection;

const servers = {
  iceServers: [
    {
      urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
    },
  ],
};

let init = async () => {
  client = await AgoraRTM.createInstance(APP_ID);
  await client.login({ uid, token });

  channel = client.createChannel('main');
  await channel.join();

  channel.on('MemberJoined', handleUserJoined);
  channel.on('MemberLeft', handleUserLeft);

  client.on('MessageFromPeer', handleMessageFromPeer);

  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  document.getElementById('user-1').srcObject = localStream;
};

let handleMessageFromPeer = async (message, MemberId) => {
  message = JSON.parse(message.text);

  if (message.type === 'offer') {
    createAnswer(MemberId, message.offer);
  }

  if (message.type === 'answer') {
    addAnswer(message.answer);
  }

  if (message.type === 'candidate') {
    if (peerConnection) {
      peerConnection.addIceCandidate(message.candidate);
    }
  }

  if (message.type === 'prompt') {
    // Show the received prompt from the other user
    showPrompt(message.prompt);
  }
};

let handleUserJoined = async (MemberId) => {
  console.log('A new user joined the channel:', MemberId);
  if (MemberId === uid) {
    createOffer(MemberId);
    document.getElementById('username').style.display = 'none'; // Hide the username when you join the call
    prompting(); // Start prompting when you join the call
  } else if (!theyid) {
    theyid = MemberId;
    createOffer(MemberId);
    document.getElementById('username').style.display = 'none'; // Hide the username when the user is in the call
  }
  // Don't call prompting() here. We want the user who joined later to start prompting.
};

let handleUserLeft = (MemberId) => {
  if (MemberId === theyid) {
    document.getElementById('user-2').style.display = 'none';
    theyid = null; // Reset theyid to allow matching with a new user

    // Remove the remote stream when the user leaves
    if (remoteStream) {
      remoteStream.getTracks().forEach((track) => track.stop());
      remoteStream = null;
      document.getElementById('user-2').srcObject = null;
    }
  }
};

let createPeerConnection = async (MemberId) => {
  peerConnection = new RTCPeerConnection(servers);

  remoteStream = new MediaStream();
  document.getElementById('user-2').srcObject = remoteStream;
  document.getElementById('user-2').style.display = 'block';

  if (!localStream) {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    document.getElementById('user-1').srcObject = localStream;
  }

  localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => {
      remoteStream.addTrack(track);
    });
  };

  peerConnection.onicecandidate = async (event) => {
    if (event.candidate) {
      client.sendMessageToPeer({ text: JSON.stringify({ type: 'candidate', candidate: event.candidate }) }, MemberId);
    }
  };
};

let createOffer = async (MemberId) => {
  await createPeerConnection(MemberId);

  let offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  client.sendMessageToPeer({ text: JSON.stringify({ type: 'offer', offer: offer }) }, MemberId);
};

let createAnswer = async (MemberId, offer) => {
  await createPeerConnection(MemberId);

  await peerConnection.setRemoteDescription(offer);

  let answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  client.sendMessageToPeer({ text: JSON.stringify({ type: 'answer', answer: answer }) }, MemberId);
};

let addAnswer = async (answer) => {
  if (!peerConnection.currentRemoteDescription) {
    peerConnection.setRemoteDescription(answer);
  }
};

let leaveChannel = async () => {
  await channel.leave();
  await client.logout();
};

let toggleCamera = async () => {
  let videoTrack = localStream.getTracks().find((track) => track.kind === 'video');

  if (videoTrack.enabled) {
    videoTrack.enabled = false;
    document.getElementById('default-1').style.display = 'block';
    document.getElementById('user-1').style.display = 'none';

    document.getElementById('camera-btn').style.backgroundColor = 'rgb(255, 80, 80)';
  } else {
    videoTrack.enabled = true;
    document.getElementById('default-1').style.display = 'none';
    document.getElementById('user-1').style.display = 'block';
    document.getElementById('camera-btn').style.backgroundColor = 'rgba(230, 207, 247, 0.9)';
  }
};

let toggleMic = async () => {
  let audioTrack = localStream.getTracks().find((track) => track.kind === 'audio');

  if (audioTrack.enabled) {
    audioTrack.enabled = false;
    document.getElementById('mic-btn').style.backgroundColor = 'rgb(255, 80, 80)';
  } else {
    audioTrack.enabled = true;
    document.getElementById('mic-btn').style.backgroundColor = 'rgba(230, 207, 247, 0.9)';
  }
};

window.addEventListener('beforeunload', leaveChannel);

document.getElementById('camera-btn').addEventListener('click', toggleCamera);
document.getElementById('mic-btn').addEventListener('click', toggleMic);

init();

let prompts = ['What are you most worried about right now?', 'What would motivate you to run a marathon?', 'Would you rather go without junk food for a year or go without TV for a year?', 'If you could meet anybody in history, past or present, who would it be?', 'Which is better, being the boss or an employee?', 'Do you believe in fate?', "What are some things that you shouldn't say during a marriage proposal?", 'What is your favorite day of the year?', 'What movies have you re-watched the most number of times?' , 'What is the best part of your day?', 'Do you prefer cats or dogs?', 'Describe your favorite type of pizza?', 'What is your favorite sports team?', 'What was your worst restaurant experience?'];

function getPrompts() {
  let promptsArray = prompts;
  let randomIndex = Math.floor(Math.random() * prompts.length);
  let element = promptsArray[randomIndex];
  promptsArray.splice(randomIndex, 1); // Fix the removal of prompt from the array
  return element;
}

let notification = new Audio('sounds/notif.wav');

function showPrompt(message) {
  const interval = 4000;
  const promptContainer = document.getElementById('prompt-container');

  const prompt = document.createElement('div');
  prompt.classList.add('prompt');
  prompt.innerText = message;
  promptContainer.appendChild(prompt);

  // Trigger reflow to apply the initial opacity before the transition starts
  prompt.getBoundingClientRect();

  prompt.style.opacity = 1; // Set opacity to fully visible

  // After a short delay, fade out and remove the prompt
  setTimeout(() => {
    prompt.style.opacity = 0; // Set opacity to fully transparent
    setTimeout(() => {
      prompt.remove(); // Remove the prompt element from the DOM
    }, 500); // Wait for the transition to complete (0.5 seconds) before removing
  }, interval - 500); // Show the prompt for (interval - 500) milliseconds before fading out
}

function prompting() {
  const interval = 4000;
  setInterval(() => {
    let prompt = getPrompts();
    if (prompt === undefined) {
      clearInterval();
      return;
    }
    notification.play();
    showPrompt(prompt);

    // Send the prompt message to the other user using Agora RTM
    client.sendMessageToPeer({ text: JSON.stringify({ type: 'prompt', prompt: prompt }) }, theyid);
  }, interval);
}
