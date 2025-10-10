import React, { useEffect, useRef, useState } from "react";
import AgoraRTC from "agora-rtc-sdk-ng";

export default function VideoPlayer({ appId, token, channelName, uid }) {
  const [joined, setJoined] = useState(false);
  const [remoteUsers, setRemoteUsers] = useState([]);
  const localVideoRef = useRef();
  const clientRef = useRef(null);

  useEffect(() => {
    const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
    clientRef.current = client;

    const joinChannel = async () => {
      try {
        await client.join(appId, channelName, token, uid);

        const localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
        const localVideoTrack = await AgoraRTC.createCameraVideoTrack();

        localVideoTrack.play(localVideoRef.current);

        await client.publish([localAudioTrack, localVideoTrack]);
        setJoined(true);

        client.on("user-published", async (user, mediaType) => {
          await client.subscribe(user, mediaType);

          if (mediaType === "video") {
            setRemoteUsers(prev => [...prev, user]);
          }

          if (mediaType === "audio") {
            const audioTrack = user.audioTrack;
            audioTrack.play();
          }
        });

        client.on("user-unpublished", user => {
          setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
        });
      } catch (err) {
        console.error(err);
      }
    };

    joinChannel();

    return () => {
      client.leave();
    };
  }, [appId, channelName, token, uid]);

  return (
    <div className="video-container">
      <div className="local-video" ref={localVideoRef}></div>
      <div className="remote-videos">
        {remoteUsers.map(user => (
          <div key={user.uid} id={`remote-${user.uid}`}></div>
        ))}
      </div>
    </div>
  );
}
