import AgoraRTC from "agora-rtc-sdk-ng";

export const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

export const joinChannel = async (appId, token, channel, uid, setLocalTrack) => {
  await client.join(appId, channel, token, uid);

  const localTracks = {
    videoTrack: await AgoraRTC.createCameraVideoTrack(),
    audioTrack: await AgoraRTC.createMicrophoneAudioTrack(),
  };

  setLocalTrack(localTracks.videoTrack);

  await client.publish(Object.values(localTracks));
  return localTracks;
};

export const leaveChannel = async (localTracks) => {
  for (let track of Object.values(localTracks)) {
    track.stop();
    track.close();
  }
  await client.leave();
};
