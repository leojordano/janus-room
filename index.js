import Janus from './janus.js'
window.janus = Janus
import volumeMeter from 'volume-meter-skip'

class Room {

  // janusInstance = null;
  // remoteStreams = [];
  // janusPlugins = [ 'video', 'audio' ];

  // // Assign the values
  // server = '';
  // opaqueId = "videoroomtest-" + Janus.randomString(12);
  // room = null;
  // publish = false;
  // extensionId = Janus.useDefaultDependencies();
  // token = null;
  // useRecordPlugin = false;
  // volumeMeterSkip = 0;
  // debugMode = false;
  // consentDialog = false

  // myid = null;
  // mypvtid = null;
  // mystream = null;

  // // Plugin Handles
  // videoRoomHandler = null;
  // recordHandle = null

  // // Events
  // onLocalJoin = () => {};
  // onRemoteJoin = () => {};
  // onRemoteUnjoin = () => {};
  // onRecordedPlay = () => {};
  // onMessage = () => {};
  // onDestroyed = () => {};
  // onVolumeMeterUpdate = () => {};
  // onError = () => {};
  // onWarning = () => {};
  // onRemoteUpdate = () => {};

  // iceServers = []
  // feeds = []

  constructor(options) {
    const defaultFunction = (log) => {
      console.log(log)
    }

    this.useVideoPlugins = options.useVideoPlugins || false;

    this.server = options.server || '';
    this.opaqueId = "videoroomtest-" + Janus.randomString(12);
    this.room = options.room || null;
    // this.publishOwnFeed = options.publishOwnFeed || false;
    this.extensionId = options.extensionId || Janus.useDefaultDependencies();
    this.token = options.token || null;
    this.useRecordPlugin = options.useRecordPlugin || false;
    this.volumeMeterSkip = options.volumeMeterSkip || 0;
    this.debugMode = options.debugMode || false;
    this.consentDialog = false

    // Events
    this.onLocalJoin = options.onLocalJoin || defaultFunction('onLocalJoin not found');
    this.onRemoteJoin = options.onRemoteJoin || defaultFunction('onRemoteJoin not found');
    this.onRemoteUnjoin = options.onRemoteUnjoin || defaultFunction('onRemoteUnjoin not found');
    this.onRecordedPlay = options.onRecordedPlay || defaultFunction('onRecordedPlay not found');
    this.onMessage = options.onMessage || defaultFunction('onMessage not found');
    this.onDestroyed = options.onDestroyed || defaultFunction('onDestroyed not found');
    this.onVolumeMeterUpdate = options.onVolumeMeterUpdate || defaultFunction('onVolumeMeterUpdate not found');
    this.onError = options.onError || defaultFunction('onError not found');
    this.onWarning = options.onWarning || defaultFunction('onWarning not found');
    this.onRemoteUpdate = options.onRemoteUpdate || defaultFunction('onRemoteUpdate not found');

    this.iceServers = options.iceServers || []
    this.videoRoomHandler = {};
    this.janusPlugins = [ 'video', 'audio' ];

    this.feeds = []
    this.remotestreams = []
    this.janusInstance = null
    this.myid = null;
    this.mypvtid = null;
    this.mystream = null;

    // Plugin Handles
    this.videoRoomHandler = null;
    this.recordHandle = null
  }

  // Run to init app
  init() {
    return new Promise((resolve, reject) => {
      try {
        /* A comment. */
        Janus.init({
          debug: this.debugMode,
          extensionId: this.extensionId,

          callback: () => {
            this.handleStartJanus()
              .then(() => {
                Janus.debug( 'booting janus' )
                resolve();
              })
              .catch((err) => {
                this.onError('iniy: ' + err);
              });
          }
        })
      } catch(err) {
        reject(err)
      }
    })
  }

  handleStartJanus() {
    return new Promise((resolve, reject) => {
      try {
        if (!Janus.isWebrtcSupported()) {
          this.onError("handleStartJanus: No WebRTC support... ");
          return;
        }

        this.janusInstance = new Janus({
          server: this.server,
          token: this.token,
          iceServers: this.iceServers,
          success: () => {
            if(this.janusPlugins.includes('video')) {
              this.attachVideoPlugin(this.janusInstance, this.opaqueId)
            }

            resolve()
          }
        })
      } catch (e) {
        reject(e)
      }
    })
  }

  setVideoRoomHandler(value) {
    this.videoRoomHandler = value
  }

  // Attach video plugin
  attachVideoPlugin() {
      Janus.debug( 'attaching video plugin' )
      let videoRoomHandler = {};

      this.janusInstance.attach({
        plugin: "janus.plugin.videoroom",
        opaqueId: this.opaqueId,
        success: (pluginHandle) => {
          console.log(pluginHandle)
          this.videoRoomHandler = window.myfeed = pluginHandle;
          console.log( pluginHandle.webrtcStuff )
          Janus.debug("Plugin attached! (" + this.videoRoomHandler.getPlugin() + ", id=" + this.videoRoomHandler.getId() + ")");
        },
        error: (error) => {
          Janus.error("  -- Error attaching video plugin...", error);
          this.onError("attachVideoPlugin/error: Error attaching video plugin... " + error);
        },
        consentDialog: (on) => {
          Janus.debug("Consent dialog should be " + (on ? "on" : "off") + " now");
          this.consentDialog = on
        },
        mediaState: (medium, on) => {
          Janus.log("Janus " + (on ? "started" : "stopped") + " receiving our " + medium);
          // FIXME Be aware, in Chrome, this on signal is not always true
        },
        webrtcState: (on) => {
          Janus.log("Janus says our WebRTC PeerConnection is " + (on ? "up" : "down") + " now");
        },
        onmessage: (msg, jsep) => {
          Janus.debug(" ::: Got a message (publisher) :::");
          var event = msg["videoroom"];

          const joinedEventHandle = () => {
            this.myid = msg["id"];
            this.mypvtid = msg["private_id"];
            Janus.log("Successfully joined room " + msg["room"] + " with ID " + this.myid);

            this.publishOwnFeed({
              audioRecv: true,
              videoSend: true,
              keepVideo: true,
              replaceVideo: true,
            });

            if (msg["publishers"] !== undefined && msg["publishers"] !== null) {
              var list = msg["publishers"];
              Janus.debug("List of remote publishers: " + list);
              for (var f in list) {
                var id = list[f]["id"];
                var display = list[f]["display"];
                var audio = list[f]["audio_codec"];
                var video = list[f]["video_codec"];
                Janus.debug("  >> [" + id + "] " + display + " (audio: " + audio + ", video: " + video + ")");
                this.newRemoteFeed(id, display, audio, video);
              }
            }
          }

          const destroyedEventHandle = () => {
            // The room has been destroyed
            Janus.warn("The room has been destroyed!");
            this.onDestroyed();
          }

          const eventHandle = () => {
            // Any new feed to attach to?
            if (msg["publishers"] !== undefined && msg["publishers"] !== null) {
              var list = msg["publishers"];
              Janus.log("Successfully joined room " + msg["room"] + " with ID " + this.myid);
              for (var f in list) {
                var id = list[f]["id"];
                var display = list[f]["display"];
                var audio = list[f]["audio_codec"];
                var video = list[f]["video_codec"];
                Janus.debug("  >> [" + id + "] " + display + " (audio: " + audio + ", video: " + video + ")");
                this.newRemoteFeed(id, display, audio, video);
              }
            } else if (msg["leaving"] !== undefined && msg["leaving"] !== null) {
              // One of the publishers has gone away?
              var leaving = msg["leaving"];
              Janus.log("Publisher left: " + leaving);

              var remoteFeed = null;
              for (var i = 1; i < 6; i++) {
                if (this.feeds[i] != null && this.feeds[i] != undefined && this.feeds[i].rfid == leaving) {
                  remoteFeed = this.feeds[i];
                  break;
                }
              }

              if (remoteFeed != null) {
                Janus.debug("Feed " + remoteFeed.rfid + " (" + remoteFeed.rfdisplay + ") has left the room, detaching");
                this.feeds[remoteFeed.rfindex] = null;
                remoteFeed.detach();
              }
            } else if (msg["unpublished"] !== undefined && msg["unpublished"] !== null) {
              // One of the publishers has unpublished?
              var unpublished = msg["unpublished"];
              Janus.log("Publisher left: " + unpublished);
              if (unpublished === 'ok') {
                // That's us
                this.videoRoomHandler.hangup();
                return;
              }

              var remoteFeed = null;
              for (var i = 1; i < 6; i++) {
                if (this.feeds[i] != null && this.feeds[i] != undefined && this.feeds[i].rfid == unpublished) {
                  remoteFeed = this.feeds[i];
                  break;
                }
              }

              if (remoteFeed != null) {
                Janus.debug("Feed " + remoteFeed.rfid + " (" + remoteFeed.rfdisplay + ") has left the room, detaching");
                this.feeds[remoteFeed.rfindex] = null;
                remoteFeed.detach();
              }

            } else if (msg["error"] !== undefined && msg["error"] !== null) {
              if (msg["error_code"] === 426) {
                this.onError('The room is unavailable. Please create one.');
              } else {
                this.onError(msg["error"]);
              }
            }
          }

          const EVENTS = {
            "joined": joinedEventHandle,
            "destroyed": destroyedEventHandle,
            "event": eventHandle
          }

          if(event) {
            const eventHandle = EVENTS[event]
            eventHandle && eventHandle()
          }

          if (jsep !== undefined && jsep !== null) {
            Janus.debug("Handling SDP as well...");
            Janus.debug(jsep);
            this.videoRoomHandler.handleRemoteJsep({
              jsep: jsep
            });

            // Check if any of the media we wanted to publish has
            // been rejected (e.g., wrong or unsupported codec)
            var audio = msg["audio_codec"];
            if (this.mystream && this.mystream.getAudioTracks() && this.mystream.getAudioTracks().length > 0 && !audio) {
              // Audio has been rejected
              this.onWarning("Microfone rejeitado, não será possivel reproduzir o seu audio.")
              Janus.debug("Our audio stream has been rejected, viewers won't hear us");
            }

            var video = msg["video_codec"];
            if (this.mystream && this.mystream.getVideoTracks() && this.mystream.getVideoTracks().length > 0 && !video) {
              // Video has been rejected
              this.onWarning("Video rejeitado, não sera possivel transmitir sua webcam.")
              Janus.debug("Our video stream has been rejected, viewers won't see us");
            // Hide the webcam video
            }

          }
        },

        onlocaltrack: (track, on) => {
          this.mystream = window.mystream = stream;

          this.onLocalJoin();

        },

        onlocalstream: (stream) => {
          Janus.debug(" ::: Got a local stream :::");
          this.mystream = window.mystream = stream; // attach to global for debugging purpose
          if (this.mystream.getVideoTracks().length > 0) {
            this.mystream.getVideoTracks()[0].onended = () => {
              if (this.isShareScreenActive && this.publishOwnFeed) {
                Janus.debug('Put back the webcam');
                this.publishOwnFeed({
                  audioSend: true,
                  videoSend: true,
                  replaceVideo: true,
                  replaceAudio: true,
                });
              }
            }
          }

          Janus.debug(stream);
          this.onLocalJoin();
          if (this.onVolumeMeterUpdate) {
            let ctx = new AudioContext();
            let meter = volumeMeter(ctx, { tweenIn:2, tweenOut:6, skip:this.volumeMeterSkip}, (volume) => {
              this.onVolumeMeterUpdate(0, volume);
            });
            let src = ctx.createMediaStreamSource(this.mystream);
            src.connect(meter);
            this.mystream.onended = meter.stop.bind(meter);
          }
        },

        onremotestream: (stream) => {
          // The publisher stream is sendonly, we don't expect anything here
        },

        ondataopen: (data) => {
          console.log('ondataopen');
        },

        oncleanup: () => {
          Janus.log(" ::: Got a cleanup notification: we are unpublished now :::");
          this.mystream = null;
        },
      });

      this.setVideoRoomHandler(videoRoomHandler)
  }

  register(options) {
      try {
        if (!options || (options && !options.username)) {
          throw 'username value is needed.';
        }

        if (!options || (options && !options.room)) {
          throw 'room value is needed.';
        }

        this.room = options.room || this.room;


        var register = {
          "request": "join",
          "room": options.room,
          "ptype": "publisher",
          "display": options.username
        };

        if (this.token) register.token = this.token;

        this.videoRoomHandler.send({
          "message": register
        });


        Janus.log('User registered: ' + register.username)
      } catch (e) {
        this.onError('Unable to register user - ', e)
      }
  }

  attachStream(target, stream) {
    return new Promise((resolve, reject) => {
      try {
        console.log('Chegou aqui')
        // Attach the video stream, index 0 is the local video
        // Janus.listDevices(devices => console.log('devices: ', devices) )
        Janus.attachMediaStream(target, stream);
        resolve();
      } catch ( err ) {
        reject(err);
      }
    });
  }

  reAttachStream(to, from) {
    return new Promise((resolve, reject) => {
      try {
        Janus.reattachMediaStream(to, from);
        resolve();
      } catch ( err ) {
        reject(err);
      }
    });
  }

  detachStream(target, stream) {
    return new Promise((resolve, reject) => {
      try {
        this.stop()
        this.attachStream(target, stream);
        // this.videoRoomHandler.destroy(target, stream);
        resolve();
      } catch ( err ) {
        reject(err);
      }
    });
  }

  updateMediaStream(mediaStream) {
    this.publishOwnFeed({
      replaceVideo: true,
      update: false,
      keepVideo: false,
      stream: mediaStream
    })
  }

  newRemoteFeed(id, display, audio, video) {
    // A new feed has been published, create a new plugin handle and attach to it as a subscriber
    var remoteFeed = null;
    this.janusInstance.attach({
      plugin: "janus.plugin.videoroom",
      opaqueId: this.opaqueId,
      success: (pluginHandle) => {
        remoteFeed = pluginHandle;
        remoteFeed.simulcastStarted = false;
        Janus.log("Plugin attached! (" + remoteFeed.getPlugin() + ", id=" + remoteFeed.getId() + ")");
        Janus.log("  -- This is a subscriber");
        // We wait for the plugin to send us an offer
        var listen = {
          "request": "join",
          "room": this.room,
          "ptype": "subscriber",
          "feed": id,
          "private_id": this.mypvtid
        };

        if (this.token) listen.token = this.token;
        // In case you don't want to receive audio, video or data, even if the
        // publisher is sending them, set the 'offer_audio', 'offer_video' or
        // 'offer_data' properties to false (they're true by default), e.g.:
        // 		listen["offer_video"] = false;
        // For example, if the publisher is VP8 and this.is Safari, let's avoid video
        if(Janus.webRTCAdapter.browserDetails.browser === "safari" && (video === "vp9" || (video === "vp8" && !Janus.safariVp8))) {
          if (video) {
            video = video.toUpperCase()
          }
          console.log('Janus: caiu aqui!!')
          Janus.debug("Publisher is using " + video + ", but Safari doesn't support it: disabling video");
          listen["offer_video"] = false;
        }

        listen["offer_data"] = true;
        remoteFeed.videoCodec = video;
        remoteFeed.send({
          "message": listen
        });

        // Setup DataChannel
        var body = {
          "request": "setup",
        }

        if (this.token) body.token = this.token;

        pluginHandle.send({
          "message": body
        });

      },
      error: (error) => {
        Janus.error("  -- Error attaching plugin...", error);
        this.onError("newRemoteFeed/error: Error attaching plugin... " + error);
      },
      onmessage: (msg, jsep) => {
        Janus.debug(" ::: Got a message (subscriber) :::");
        Janus.debug(msg);
        this.videoRoomHandler.alive = true;

        var event = msg["videoroom"];
        Janus.debug("Event: " + event);

        console.log(typeof this.room, this.room)
        console.log(msg)

        if (msg["error"] !== undefined && msg["error"] !== null) {
          this.onError('newRemoteFeed/onmessage: ' + msg["error"]);
        } else if (event != undefined && event != null) {
          if (event === "attached") {
            // Subscriber created and attached
            for (var i = 1; i < 6; i++) {
              if (this.feeds[i] === undefined || this.feeds[i] === null) {
                this.feeds[i] = remoteFeed;
                remoteFeed.rfindex = i;
                break;
              }
            }

            remoteFeed.rfid = msg["id"];
            remoteFeed.rfdisplay = msg["display"];

            Janus.log("Successfully attached to feed " + remoteFeed.rfid + " (" + remoteFeed.rfdisplay + ") in room " + msg["room"]);
          } else if (event === "event") {
            // Check if we got an event on a simulcast-related event from publisher
            var substream = msg["substream"];
            var temporal = msg["temporal"];

            if ((substream !== null && substream !== undefined) || (temporal !== null && temporal !== undefined)) {

              if (!remoteFeed.simulcastStarted) {
                remoteFeed.simulcastStarted = true;
                // Add some new buttons
                this.addSimulcastButtons(remoteFeed.rfindex, remoteFeed.videoCodec === "vp8");
              }
              // We just received notice that there's been a switch, update the buttons
              this.updateSimulcastButtons(remoteFeed.rfindex, substream, temporal);
            }

          } else {
            // What has just happened?
          }
        }

        if (jsep !== undefined && jsep !== null) {
          Janus.debug("Handling SDP as well...");
          Janus.debug(jsep);
          // Answer and attach
          remoteFeed.createAnswer({
            jsep: jsep,
            // Add data:true here if you want to subscribe to datachannels as well
            // (obviously only works if the publisher offered them in the first place)
            media: {
              audioSend: false,
              videoSend: false,
              data: true,
            },
            // We want recvonly audio/video
            success: (jsep) => {
              Janus.debug("Got SDP!");
              Janus.debug(jsep);

              var body = {
                "request": "start",
                "room": this.room
              };

              if (this.token) body.token = this.token;

              remoteFeed.send({
                "message": body,
                "jsep": jsep
              });

            },

            error: (error) => {
              Janus.error("WebRTC error:", error);
              this.onError("newRemoteFeed/onmessage/createAnswer: WebRTC error... " + JSON.stringify(error));
            }
          });
        }
      },
      webrtcState: (on) => {
        Janus.log("Janus says this.WebRTC PeerConnection (feed #" + remoteFeed.rfindex + ") is " + (on ? "up" : "down") + " now");
      },
      onlocalstream: (stream) => {
        // The subscriber stream is recvonly, we don't expect anything here
      },
      ondata: (data) => {
        try {
          data = JSON.parse(data);
          this.onMessage(data);
        } catch ( err ) {
          this.onMessage({
            error: `Failed to parse JSON : ${err}`
          });
        }
      },

      onremotetrack: (track, mid, added) => {
        Janus.debug('', track)
      },

      onremotestream: (stream) => {
        Janus.debug("Remote feed #" + remoteFeed.rfindex);

        let remote = null
        let updated = false

        if(this.remotestreams && this.remotestreams.length > 0) {
          remote = this.remotestreams.find(remoteUser => remoteUser && remoteUser.rfid === remoteFeed.rfid);
        }

        if(remote && remote.feedId !== remoteFeed.getId()) {
          updated = true
        }

        if( remote && stream && updated ) {
          console.log('Janus: Atualizou o cara aqui - ', remote.index)
          remote.stream = stream
          this.remotestreams[remoteFeed.rfindex] = remote
          this.onRemoteUpdate( remote.index, remoteFeed.rfdisplay, remoteFeed.getId(), remoteFeed.rfid, stream )
        } else {
          this.remotestreams[remoteFeed.rfindex] = {}
          this.remotestreams[remoteFeed.rfindex].index = remoteFeed.rfindex;
          this.remotestreams[remoteFeed.rfindex].feedId = remoteFeed.getId();
          this.remotestreams[remoteFeed.rfindex].oldFeedId = remoteFeed.getId();
          this.remotestreams[remoteFeed.rfindex].rfid = remoteFeed.rfid;
          this.remotestreams[remoteFeed.rfindex].stream = stream;
          this.onRemoteJoin(remoteFeed.rfindex, remoteFeed.rfdisplay, remoteFeed.getId());

          if (this.onVolumeMeterUpdate) {
            let ctx = new AudioContext();
            let meter = volumeMeter(ctx, { tweenIn:2, tweenOut:6, skip:this.volumeMeterSkip}, (volume) => {
              this.onVolumeMeterUpdate(remoteFeed.rfindex, volume);
            });

            let src = ctx.createMediaStreamSource(this.remotestreams[remoteFeed.rfindex].stream);
            src.connect(meter);
            this.remotestreams[remoteFeed.rfindex].stream.onended = meter.stop.bind(meter);
            this.remotestreams[remoteFeed.rfindex].feed = remoteFeed;
          }

        }
      },
      oncleanup: () => {
        Janus.log(" ::: Got a cleanup notification (remote feed " + id + ") :::");
        if (remoteFeed.spinner !== undefined && remoteFeed.spinner !== null) {
          remoteFeed.spinner.stop();
        }

        remoteFeed.spinner = null;
        delete (this.remotestreams[remoteFeed.rfindex]);
        this.onRemoteUnjoin(remoteFeed.rfindex, remoteFeed.rfdisplay);
      }
    });

  }

  publishOwnFeed(opts, cb = () => {}) {
    opts = opts || {}
    // Publish our stream
    this.videoRoomHandler.createOffer({
        // Add data:true here if you want to publish datachannels as well
      media: {
        audioRecv: true,
        videoRecv: true,
        audioSend: opts.audioSend,
        replaceAudio: opts.replaceAudio,
        videoSend: true,
        replaceVideo: opts.replaceVideo,
        data: true,
        update: opts.update,
      },

      stream: window.stream,
      // Publishers are sendonly
      simulcast: true,
      success: (jsep) => {
        Janus.debug("Got publisher SDP!");
        Janus.debug(jsep);
        var publish = {
          "request": "configure",
          "audio": opts.audioSend,
          "video": true,
          "data": true,
        };
        if (this.token) publish.token = this.token;

        this.videoRoomHandler.send({
          "message": publish,
          "jsep": jsep
        });

        if (cb) {
          cb();
        }
      },
      error: (error) => {
        Janus.error("WebRTC error:", error);
        if (opts && opts.audioSend) {
          this.publishOwnFeed({
            audioSend: false
          });
        } else {
          this.onError("publishOwnFeed: WebRTC error... " + JSON.stringify(error));
        }
      }
    });
  }

  isEquivalent(a, b) {
    // Create arrays of property names
    var aProps = Object.getOwnPropertyNames(a);
    var bProps = Object.getOwnPropertyNames(b);

    // If number of properties is different,
    // objects are not equivalent
    if (aProps.length != bProps.length) {
        return false;
    }

    for (var i = 0; i < aProps.length; i++) {
        var propName = aProps[i];

        // If values of same property are not equal,
        // objects are not equivalent
        if (a[propName] !== b[propName]) {
            return false;
        }
    }

    // If we made it this far, objects
    // are considered equivalent
    return true;
  }

  unpublishOwnFeed() {
    return new Promise((resolve, reject) => {
      var unpublish = {
        "request": "unpublish",
      };

      if (this.token) unpublish.token = this.token;

      this.videoRoomHandler.send({
        "message": unpublish,
        success: () => {
          resolve();
        },
        error: (err) => {
          reject(err);
        }
      });

    });
  }

  stop() {
    if (this.janusInstance) {
      this.stopRecording();
      // Make sure the webcam and microphone got turned off first
      if (this.mystream) {
        let tracks = this.mystream.getTracks();
        for (let i in tracks) {
          if (tracks[i]) {
            tracks[i].stop();
          }
        }
      }
      // Destroy the session
      this.janusInstance.destroy();
    }
  }

  stopRecording() {
    return new Promise((resolve, reject) => {
      if (this.recordPlayHandler) {
        var stop = {
          "request": "stop"
        };
        this.recordPlayHandler.send({
          "message": stop,
          success: function() {
            resolve();
          },
          error: function(err) {
            reject(err);
          }
        });
      }
    });
  }

  getStreamBitrate(streamIndex) {
    return new Promise((resolve, reject) => {
      try {
        if (this.remotestreams[streamIndex] && this.remotestreams[streamIndex].feed && ''+streamIndex !== '0') {
          resolve(this.remotestreams[streamIndex].feed.getBitrate());
        } else if (this.videoRoomHandler && ''+streamIndex === '0') {
          resolve(this.videoRoomHandler.alive ? true : false);
        } else {
          reject(new Error('No such stream index: ' + streamIndex));
        }
      } catch(e) {
        reject(e);
      }
    });
  }

  getStream(streamIndex) {
    return new Promise((resolve, reject) => {
      try {
        if ('' + streamIndex === '0') {
          resolve(this.mystream);
        } else {
          if (this.remotestreams[streamIndex]) {
            resolve(this.remotestreams[streamIndex].stream);
          } else {
            reject(new Error('No such stream index: ' + streamIndex));
          }
        }

      } catch(e) {
        reject(e);
      }
    });
  }

  toggleMuteAudio() {
    return new Promise((resolve, reject) => {
      try {
        let muted = this.videoRoomHandler.isAudioMuted() ? this.videoRoomHandler.isAudioMuted()  : false;
        Janus.log((muted ? "Unmuting" : "Muting") + " local stream...");
        if (muted) {
          this.videoRoomHandler.unmuteAudio();
        } else {
          this.videoRoomHandler.muteAudio();
        }
        resolve(muted);
      } catch ( err ) {
        reject(err);
      }
    });
  }

  toggleMuteVideo() {
    return new Promise((resolve, reject) => {
      try {
        let muted = this.videoRoomHandler.isVideoMuted() ? this.videoRoomHandler.isVideoMuted() : false;
        Janus.log((muted ? "Unmuting" : "Muting") + " local stream...");
        if (muted) {
          this.videoRoomHandler.unmuteVideo();
        } else {
          this.videoRoomHandler.muteVideo();
        }
        resolve(muted);
      } catch ( err ) {
        reject(err);
      }
    });
  }

  removeRoom() {
    return new Promise((resolve, reject) => {
      try {
        // TODO handle room's secret
        var body = {
          "request": "destroy",
          "room": this.room,
        };
        if (this.token) body.token = this.token;
        this.videoRoomHandler.send({
          "message": body,
        });
        resolve();
      } catch ( err ) {
        reject(err);
      }
    });
  }

  getRecordedList() {
    return new Promise((resolve, reject) => {
      var body = {
        "request": "list"
      };
      Janus.debug("Sending message (" + JSON.stringify(body) + ")");
      config.recordPlayHandler.send({
        "message": body,
        success: function(result) {
          resolve(result);
        },
        error: function(err) {
          reject(err);
        }
      });
    });
  }

  // TODO Fix me.
  // Helpers to create Simulcast-related UI, if enabled
  addSimulcastButtons(feed, temporal) {}

  updateSimulcastButtons(feed, substream, temporal) {}
}

export default Room;
