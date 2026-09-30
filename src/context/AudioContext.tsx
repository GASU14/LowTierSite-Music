import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Track } from '../types';
import { grabYouTubeAudio, grabYouTubeVideo, searchItunes } from '../services/api';
import { useAuth } from './AuthContext';

interface AudioContextType {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  queue: Track[];
  history: Track[];
  repeatMode: 'off' | 'all' | 'one';
  isShuffle: boolean;
  isGrabbing: boolean;
  sourceType: 'audio' | 'video' | 'youtube' | 'none';
  youtubeUrl: string | null;
  activeVideoId: string | null;
  musicVideoId: string | null;
  isVideoMode: boolean;
  setIsVideoMode: (val: boolean) => void;
  switchVideoSource: (videoId: string) => void;
  reparentYtPlayer: (targetEl: HTMLElement | null) => void;
  playTrack: (track: Track, newQueue?: Track[]) => Promise<void>;
  togglePlay: () => void;
  seek: (seconds: number) => void;
  setVolume: (vol: number) => void;
  toggleMute: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  toggleRepeat: () => void;
  toggleShuffle: () => void;
  addToQueue: (track: Track) => void;
  playDirectUrl: (url: string, title?: string, artist?: string) => Promise<void>;
  isExpandedPlayer: boolean;
  setIsExpandedPlayer: (val: boolean) => void;
  savedTracks: Track[];
  toggleSaveTrack: (track: Track) => void;
  isTrackSaved: (trackId: number | string) => boolean;
  toggleFavorite: (track: Track) => void;
  isFavorite: (trackId: number | string) => boolean;
  trackSources: Array<{ id: string; title: string; owner: string; score: number; durationSec?: number }>;
  currentSourceId: string | null;
  switchTrackSource: (videoId: string) => void;
  getTrackDuration: (track: Track) => number;
  trackDurationsMap: Record<string, number>;
}

const AudioContext = createContext<AudioContextType | null>(null);

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, userProfile, recordListen, syncSavedTracksToCloud, updateTrackSourceSelection } = useAuth();

  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [queue, setQueue] = useState<Track[]>([]);
  const [history, setHistory] = useState<Track[]>([]);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');
  const [isShuffle, setIsShuffle] = useState(false);
  const [isGrabbing, setIsGrabbing] = useState(false);
  const [sourceType, setSourceType] = useState<'audio' | 'video' | 'youtube' | 'none'>('none');
  const [youtubeUrl, setYoutubeUrl] = useState<string | null>(null);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [musicVideoId, setMusicVideoId] = useState<string | null>(null);
  const [isVideoMode, setIsVideoModeState] = useState(false);
  const [isExpandedPlayer, setIsExpandedPlayer] = useState(false);

  const [trackSourcesMap, setTrackSourcesMap] = useState<Record<string, Array<{ id: string; title: string; owner: string; score: number; durationSec?: number }>>>({});
  const [currentSourceId, setCurrentSourceId] = useState<string | null>(null);

  // Cache real YouTube durations for tracks (in seconds)
  const [trackDurationsMap, setTrackDurationsMap] = useState<Record<string, number>>(() => {
    try {
      const s = localStorage.getItem('ytify_track_durations');
      return s ? JSON.parse(s) : {};
    } catch {
      return {};
    }
  });
  const trackDurationsRef = useRef<Record<string, number>>({});
  useEffect(() => {
    trackDurationsRef.current = trackDurationsMap;
  }, [trackDurationsMap]);

  const updateRealDuration = useCallback((trackId: string | number, durSec: number) => {
    if (!durSec || isNaN(durSec) || durSec <= 0) return;
    const rounded = Math.round(durSec);
    setDuration(rounded);
    durationRef.current = rounded;

    setTrackDurationsMap((prev) => {
      if (prev[String(trackId)] === rounded) return prev;
      const updated = { ...prev, [String(trackId)]: rounded };
      try {
        localStorage.setItem('ytify_track_durations', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    setCurrentTrack((prev) => {
      if (prev && String(prev.id) === String(trackId)) {
        return { ...prev, durationMs: rounded * 1000 };
      }
      return prev;
    });
  }, []);

  const getTrackDuration = useCallback((tr: Track): number => {
    if (!tr) return 180000;
    if (currentTrackRef.current && String(currentTrackRef.current.id) === String(tr.id) && durationRef.current > 0) {
      return durationRef.current * 1000;
    }
    const cached = trackDurationsRef.current[String(tr.id)];
    if (cached && cached > 0) return cached * 1000;
    return tr.durationMs || 180000;
  }, []);

  const trackSources = currentTrack ? (trackSourcesMap[String(currentTrack.id)] || []) : [];

  // Saved tracks
  const [savedTracks, setSavedTracks] = useState<Track[]>(() => {
    try {
      const saved = localStorage.getItem('music_saved_tracks');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (userProfile?.savedTracks && userProfile.savedTracks.length > 0) {
      setSavedTracks(userProfile.savedTracks);
    }
  }, [userProfile?.uid]);

  const toggleSaveTrack = useCallback((track: Track) => {
    setSavedTracks((prev) => {
      const exists = prev.some((t) => t.id === track.id);
      const updated = exists ? prev.filter((t) => t.id !== track.id) : [track, ...prev];
      try {
        localStorage.setItem('music_saved_tracks', JSON.stringify(updated));
      } catch {}
      if (user) {
        syncSavedTracksToCloud(updated);
      }
      return updated;
    });
  }, [user, syncSavedTracksToCloud]);

  const isTrackSaved = useCallback(
    (trackId: number | string) => savedTracks.some((t) => t.id === trackId),
    [savedTracks]
  );

  // HTML5 Audio element fallback / direct stream reference
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // YouTube player reference
  const ytPlayerRef = useRef<any>(null);
  const isYtReadyRef = useRef<boolean>(false);
  const pendingVideoIdRef = useRef<string | null>(null);
  const activeVideoTargetRef = useRef<HTMLElement | null>(null);

  // Continuous positioning RAF loop for YouTube overlay video container
  useEffect(() => {
    let animFrame: number;
    const updatePosition = () => {
      const hostEl = document.getElementById('yt-audio-player-host');
      const targetEl = activeVideoTargetRef.current;
      if (hostEl && targetEl) {
        const rect = targetEl.getBoundingClientRect();
        hostEl.style.position = 'fixed';
        hostEl.style.top = `${rect.top}px`;
        hostEl.style.left = `${rect.left}px`;
        hostEl.style.width = `${rect.width}px`;
        hostEl.style.height = `${rect.height}px`;
        hostEl.style.zIndex = '110';
        hostEl.style.opacity = '1';
        hostEl.style.pointerEvents = 'auto';
        hostEl.style.borderRadius = '1.5rem';
        hostEl.style.overflow = 'hidden';
      }
      animFrame = requestAnimationFrame(updatePosition);
    };

    animFrame = requestAnimationFrame(updatePosition);
    return () => {
      if (animFrame) cancelAnimationFrame(animFrame);
    };
  }, []);

  // High-accuracy playback clock interpolator refs
  const clockStartTimestampRef = useRef<number>(0);
  const clockStartOffsetRef = useRef<number>(0);
  const lastYtReportedTimeRef = useRef<number>(-1);

  // Synchronized state refs for event listeners and timer callbacks
  const currentTrackRef = useRef<Track | null>(null);
  currentTrackRef.current = currentTrack;
  const queueRef = useRef<Track[]>([]);
  queueRef.current = queue;
  const repeatModeRef = useRef(repeatMode);
  repeatModeRef.current = repeatMode;
  const isShuffleRef = useRef(isShuffle);
  isShuffleRef.current = isShuffle;
  const volumeRef = useRef(volume);
  volumeRef.current = volume;
  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;
  const isVideoModeRef = useRef(isVideoMode);
  isVideoModeRef.current = isVideoMode;
  const sourceTypeRef = useRef(sourceType);
  sourceTypeRef.current = sourceType;
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  const durationRef = useRef(duration);
  durationRef.current = duration;

  const playTrackRef = useRef<((track: Track, newQueue?: Track[]) => Promise<void>) | null>(null);

  // Track ended handler
  const handleTrackEnded = useCallback(() => {
    if (repeatModeRef.current === 'one') {
      clockStartTimestampRef.current = Date.now();
      clockStartOffsetRef.current = 0;
      setCurrentTime(0);

      if (sourceTypeRef.current === 'youtube' && ytPlayerRef.current && isYtReadyRef.current) {
        try {
          ytPlayerRef.current.seekTo(0, true);
          ytPlayerRef.current.playVideo();
          setIsPlaying(true);
          isPlayingRef.current = true;
        } catch {}
      } else if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
        setIsPlaying(true);
        isPlayingRef.current = true;
      }
      return;
    }

    if (!currentTrackRef.current || queueRef.current.length === 0) return;
    const currentIndex = queueRef.current.findIndex((t) => t.id === currentTrackRef.current?.id);
    let nextIndex = currentIndex + 1;

    if (isShuffleRef.current && queueRef.current.length > 1) {
      nextIndex = Math.floor(Math.random() * queueRef.current.length);
      if (nextIndex === currentIndex && queueRef.current.length > 1) {
        nextIndex = (currentIndex + 1) % queueRef.current.length;
      }
    } else if (nextIndex >= queueRef.current.length) {
      if (repeatModeRef.current === 'all') {
        nextIndex = 0;
      } else {
        setIsPlaying(false);
        isPlayingRef.current = false;
        return;
      }
    }

    const next = queueRef.current[nextIndex];
    if (next && playTrackRef.current) {
      playTrackRef.current(next);
    }
  }, []);

  // Initialize YouTube Iframe Player API & HTML5 fallback audio
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Initialize HTML5 Audio Element
    if (!audioRef.current) {
      const audio = new Audio();
      audio.preload = 'auto';
      audio.onended = () => handleTrackEnded();
      audio.ontimeupdate = () => {
        if (sourceTypeRef.current === 'audio') {
          setCurrentTime(audio.currentTime);
          clockStartOffsetRef.current = audio.currentTime;
          clockStartTimestampRef.current = Date.now();
          if (audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
            setDuration(audio.duration);
            durationRef.current = audio.duration;
          }
        }
      };
      audio.onerror = (e) => {
        console.warn("Audio element error:", e);
      };
      audioRef.current = audio;
    }

    // 2. Initialize YouTube Player
    const initYT = () => {
      const hostEl = document.getElementById('yt-audio-player-host');
      if (!hostEl) return;

      if ((window as any).YT && (window as any).YT.Player) {
        try {
          if (ytPlayerRef.current) return;
          new (window as any).YT.Player('yt-audio-player-host', {
            height: '200',
            width: '200',
            playerVars: {
              autoplay: 1,
              controls: 0,
              disablekb: 1,
              fs: 0,
              playsinline: 1,
              modestbranding: 1,
              rel: 0,
              iv_load_policy: 3,
            },
            events: {
              onReady: (event: any) => {
                ytPlayerRef.current = event.target;
                isYtReadyRef.current = true;
                event.target.setVolume(volumeRef.current);
                if (isMutedRef.current) {
                  event.target.mute();
                }
                if (pendingVideoIdRef.current) {
                  const vid = pendingVideoIdRef.current;
                  pendingVideoIdRef.current = null;
                  event.target.loadVideoById(vid);
                  clockStartTimestampRef.current = Date.now();
                  clockStartOffsetRef.current = 0;
                  event.target.playVideo();
                }
              },
              onStateChange: (event: any) => {
                // 0: ENDED, 1: PLAYING, 2: PAUSED, 3: BUFFERING
                if (event.data === 0) {
                  handleTrackEnded();
                } else if (event.data === 1 || event.data === 3) {
                  if (event.data === 1) {
                    setIsPlaying(true);
                    isPlayingRef.current = true;
                    setIsGrabbing(false);
                    clockStartTimestampRef.current = Date.now();
                  }
                  try {
                    const dur = event.target.getDuration();
                    if (typeof dur === 'number' && !isNaN(dur) && dur > 0) {
                      if (currentTrackRef.current) {
                        updateRealDuration(currentTrackRef.current.id, dur);
                      } else {
                        setDuration(dur);
                        durationRef.current = dur;
                      }
                    }
                  } catch {}
                } else if (event.data === 2) {
                  setIsPlaying(false);
                  isPlayingRef.current = false;
                }
              },
              onError: (err: any) => {
                console.warn("YouTube player encountered error:", err);
                setIsGrabbing(false);
                // Fallback to preview audio if available
                if (currentTrackRef.current?.previewUrl && audioRef.current) {
                  audioRef.current.src = currentTrackRef.current.previewUrl;
                  audioRef.current.play().then(() => {
                    setIsPlaying(true);
                    isPlayingRef.current = true;
                  }).catch(() => {});
                  setSourceType('audio');
                }
              },
            },
          });
        } catch (e) {
          console.warn("Error creating YT Player:", e);
        }
      }
    };

    if ((window as any).YT && (window as any).YT.Player) {
      initYT();
    } else {
      (window as any).onYouTubeIframeAPIReady = () => {
        initYT();
      };
    }

    // High frequency timekeeper (polls YouTube hardware time + interpolates smoothly at 30ms)
    const timer = setInterval(() => {
      if (!isPlayingRef.current) return;

      if (sourceTypeRef.current === 'youtube') {
        if (ytPlayerRef.current && isYtReadyRef.current) {
          try {
            const cur = ytPlayerRef.current.getCurrentTime();
            const dur = ytPlayerRef.current.getDuration();

            if (typeof dur === 'number' && !isNaN(dur) && dur > 0) {
              if (Math.abs(dur - durationRef.current) >= 1) {
                if (currentTrackRef.current) {
                  updateRealDuration(currentTrackRef.current.id, dur);
                } else {
                  setDuration(dur);
                  durationRef.current = dur;
                }
              }
            }

            if (typeof cur === 'number' && !isNaN(cur) && cur >= 0) {
              if (cur !== lastYtReportedTimeRef.current) {
                lastYtReportedTimeRef.current = cur;
                setCurrentTime(cur);
              }
            }
          } catch {}
        }
      }
    }, 100);

    return () => {
      clearInterval(timer);
    };
  }, [handleTrackEnded]);

  const setIsVideoMode = (val: boolean) => {
    setIsVideoModeState(val);
    isVideoModeRef.current = val;
    if (sourceTypeRef.current === 'youtube' && ytPlayerRef.current && isYtReadyRef.current && isPlayingRef.current) {
      try {
        ytPlayerRef.current.playVideo();
      } catch {}
    } else if (sourceTypeRef.current === 'audio' && audioRef.current && isPlayingRef.current) {
      audioRef.current.play().catch(() => {});
    }
  };

  // Play track function: grabs full length YouTube audio stream with exact artist & title matching
  const playTrack = async (track: Track, newQueue?: Track[]) => {
    if (newQueue && newQueue.length > 0) {
      setQueue(newQueue);
      queueRef.current = newQueue;
    } else if (!queue.some((q) => q.id === track.id)) {
      setQueue((prev) => [...prev, track]);
    }

    setCurrentTrack(track);
    currentTrackRef.current = track;
    setHistory((prev) => [track, ...prev.filter((t) => t.id !== track.id).slice(0, 49)]);
    
    // Reset clock
    setCurrentTime(0);
    clockStartOffsetRef.current = 0;
    clockStartTimestampRef.current = Date.now();
    lastYtReportedTimeRef.current = -1;

    const cachedDur = trackDurationsRef.current[String(track.id)];
    const initialDuration = cachedDur && cachedDur > 0 ? cachedDur : (track.durationMs ? track.durationMs / 1000 : 180);
    setDuration(initialDuration);
    durationRef.current = initialDuration;
    setIsGrabbing(true);

    recordListen(track);

    // Stop any current HTML5 audio
    if (audioRef.current) {
      audioRef.current.pause();
    }

    // Fetch official full track from YouTube with verified artist & title scoring
    const query = `${track.artist} - ${track.title}`;
    try {
      const res = await grabYouTubeAudio(query, false, track.artist, track.title);
      if (res?.videoId) {
        if (res.durationSec && res.durationSec > 0) {
          updateRealDuration(track.id, res.durationSec);
        }
        const sources = res.sources || [{ id: res.videoId, title: res.matchedTitle || track.title, owner: res.matchedOwner || track.artist, score: res.score || 0 }];
        setTrackSourcesMap((prev) => ({ ...prev, [String(track.id)]: sources }));

        // Background prefetch next track in queue for gapless playback
        setTimeout(() => {
          const q = queueRef.current;
          const currIdx = q.findIndex(qTr => qTr.id === track.id);
          if (currIdx !== -1 && currIdx + 1 < q.length) {
            const nextTr = q[currIdx + 1];
            if (nextTr && !trackSourcesMap[String(nextTr.id)]) {
              grabYouTubeAudio(`${nextTr.artist} - ${nextTr.title}`, false, nextTr.artist, nextTr.title)
                .then(nextRes => {
                  if (nextRes?.videoId) {
                    const nextSources = nextRes.sources || [{ id: nextRes.videoId, title: nextRes.matchedTitle || nextTr.title, owner: nextRes.matchedOwner || nextTr.artist, score: nextRes.score || 0 }];
                    setTrackSourcesMap(p => ({ ...p, [String(nextTr.id)]: nextSources }));
                  }
                }).catch(() => {});
            }
          }
        }, 1000);

        const userSelections = userProfile?.trackSourceSelections || (() => {
          try {
            const stored = localStorage.getItem('ytify_track_source_selections');
            return stored ? JSON.parse(stored) : {};
          } catch {
            return {};
          }
        })();

        let videoId = res.videoId;
        if (userSelections[String(track.id)] && sources.some((s) => s.id === userSelections[String(track.id)])) {
          videoId = userSelections[String(track.id)];
        }

        setCurrentSourceId(videoId);
        setActiveVideoId(videoId);
        setMusicVideoId(videoId);
        setYoutubeUrl(`https://www.youtube.com/watch?v=${videoId}`);
        setSourceType('youtube');

        if (ytPlayerRef.current && isYtReadyRef.current) {
          try {
            ytPlayerRef.current.loadVideoById(videoId);
            ytPlayerRef.current.setVolume(isMutedRef.current ? 0 : volumeRef.current);
            clockStartTimestampRef.current = Date.now();
            clockStartOffsetRef.current = 0;

            ytPlayerRef.current.playVideo();
            setIsPlaying(true);
            isPlayingRef.current = true;
            setIsGrabbing(false);
          } catch (loadErr) {
            console.warn("loadVideoById error:", loadErr);
          }
        } else {
          // YT player not ready yet; save videoId to play when onReady triggers
          pendingVideoIdRef.current = videoId;
          setIsPlaying(true);
          isPlayingRef.current = true;
        }
      } else {
        throw new Error("No YouTube video ID found");
      }
    } catch (err) {
      console.warn("YouTube audio resolution failed, trying fallback:", err);
      // Fallback: iTunes preview stream
      let streamUrl = track.previewUrl;
      if (!streamUrl) {
        try {
          const results = await searchItunes(`${track.artist} ${track.title}`, 2);
          if (results.length > 0 && results[0].previewUrl) {
            streamUrl = results[0].previewUrl;
            track.previewUrl = streamUrl;
          }
        } catch {}
      }

      if (streamUrl && audioRef.current) {
        setSourceType('audio');
        audioRef.current.src = streamUrl;
        audioRef.current.volume = isMutedRef.current ? 0 : volumeRef.current / 100;
        clockStartTimestampRef.current = Date.now();
        clockStartOffsetRef.current = 0;
        audioRef.current.play().then(() => {
          setIsPlaying(true);
          isPlayingRef.current = true;
        }).catch(() => {});
      }
      setIsGrabbing(false);
    }
  };

  playTrackRef.current = playTrack;

  const switchVideoSource = (videoId: string) => {
    if (!currentTrack) return;
    setActiveVideoId(videoId);
    setMusicVideoId(videoId);
    setCurrentSourceId(videoId);
    setYoutubeUrl(`https://www.youtube.com/watch?v=${videoId}`);

    // Reset clock state immediately
    setCurrentTime(0);
    clockStartOffsetRef.current = 0;
    clockStartTimestampRef.current = Date.now();
    lastYtReportedTimeRef.current = -1;

    // Check if source duration is already known in trackSources
    const sources = trackSourcesMap[String(currentTrack.id)] || [];
    const matched = sources.find((s) => s.id === videoId);
    if (matched && matched.durationSec && matched.durationSec > 0) {
      updateRealDuration(currentTrack.id, matched.durationSec);
    }

    if (ytPlayerRef.current && isYtReadyRef.current) {
      try {
        ytPlayerRef.current.loadVideoById(videoId);
        ytPlayerRef.current.playVideo();
        setIsPlaying(true);
        isPlayingRef.current = true;

        [200, 500, 1000, 1800].forEach((delay) => {
          setTimeout(() => {
            try {
              if (ytPlayerRef.current && currentTrackRef.current) {
                const dur = ytPlayerRef.current.getDuration();
                if (typeof dur === 'number' && !isNaN(dur) && dur > 0) {
                  updateRealDuration(currentTrackRef.current.id, dur);
                }
              }
            } catch {}
          }, delay);
        });
      } catch {}
    }
  };

  const switchTrackSource = (videoId: string) => {
    if (!currentTrack) return;
    setCurrentSourceId(videoId);
    setActiveVideoId(videoId);
    setMusicVideoId(videoId);
    setYoutubeUrl(`https://www.youtube.com/watch?v=${videoId}`);

    updateTrackSourceSelection(currentTrack.id, videoId);

    // Reset clock state immediately
    setCurrentTime(0);
    clockStartOffsetRef.current = 0;
    clockStartTimestampRef.current = Date.now();
    lastYtReportedTimeRef.current = -1;

    // Check if source duration is already known in trackSources
    const sources = trackSourcesMap[String(currentTrack.id)] || [];
    const matched = sources.find((s) => s.id === videoId);
    if (matched && matched.durationSec && matched.durationSec > 0) {
      updateRealDuration(currentTrack.id, matched.durationSec);
    }

    if (ytPlayerRef.current && isYtReadyRef.current) {
      try {
        ytPlayerRef.current.loadVideoById(videoId);
        ytPlayerRef.current.playVideo();
        setIsPlaying(true);
        isPlayingRef.current = true;

        [200, 500, 1000, 1800].forEach((delay) => {
          setTimeout(() => {
            try {
              if (ytPlayerRef.current && currentTrackRef.current) {
                const dur = ytPlayerRef.current.getDuration();
                if (typeof dur === 'number' && !isNaN(dur) && dur > 0) {
                  updateRealDuration(currentTrackRef.current.id, dur);
                }
              }
            } catch {}
          }, delay);
        });
      } catch {}
    }
  };

  const reparentYtPlayer = useCallback((targetEl: HTMLElement | null) => {
    activeVideoTargetRef.current = targetEl;
    const hostEl = document.getElementById('yt-audio-player-host');
    if (!hostEl) return;

    try {
      if (targetEl) {
        const rect = targetEl.getBoundingClientRect();
        hostEl.style.position = 'fixed';
        hostEl.style.top = `${rect.top}px`;
        hostEl.style.left = `${rect.left}px`;
        hostEl.style.width = `${rect.width}px`;
        hostEl.style.height = `${rect.height}px`;
        hostEl.style.zIndex = '110';
        hostEl.style.opacity = '1';
        hostEl.style.pointerEvents = 'auto';
        hostEl.style.borderRadius = '1.5rem';
        hostEl.style.overflow = 'hidden';
      } else {
        hostEl.style.position = 'fixed';
        hostEl.style.bottom = '0px';
        hostEl.style.right = '0px';
        hostEl.style.top = 'auto';
        hostEl.style.left = 'auto';
        hostEl.style.width = '200px';
        hostEl.style.height = '200px';
        hostEl.style.zIndex = '-9999';
        hostEl.style.opacity = '0.001';
        hostEl.style.pointerEvents = 'none';
        hostEl.style.borderRadius = '0px';
      }
    } catch (err) {
      console.warn("reparentYtPlayer DOM error:", err);
    }
  }, []);

  const playDirectUrl = async (url: string, title?: string, artist?: string) => {
    const customTrack: Track = {
      id: `url-${Date.now()}`,
      title: title || 'Direct Stream',
      artist: artist || 'Custom Stream',
      album: 'Direct Audio',
      artworkSmall: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=300&q=80',
      artworkLarge: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80',
      artworkOriginal: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1200&q=80',
      durationMs: 180000,
      previewUrl: url,
    };

    if (ytPlayerRef.current && isYtReadyRef.current) {
      try {
        ytPlayerRef.current.pauseVideo();
      } catch {}
    }

    if (audioRef.current) {
      audioRef.current.src = url;
      audioRef.current.volume = isMutedRef.current ? 0 : volumeRef.current / 100;
      audioRef.current.play().then(() => {
        setIsPlaying(true);
        isPlayingRef.current = true;
      }).catch(() => {});
      setSourceType('audio');
    }

    setCurrentTrack(customTrack);
    currentTrackRef.current = customTrack;
    clockStartTimestampRef.current = Date.now();
    clockStartOffsetRef.current = 0;
  };

  const togglePlay = () => {
    if (!currentTrack) return;
    if (isPlaying) {
      if (sourceTypeRef.current === 'youtube' && ytPlayerRef.current && isYtReadyRef.current) {
        try {
          ytPlayerRef.current.pauseVideo();
        } catch {}
      } else if (audioRef.current) {
        audioRef.current.pause();
      }
      setIsPlaying(false);
      isPlayingRef.current = false;
    } else {
      clockStartTimestampRef.current = Date.now();
      clockStartOffsetRef.current = currentTime;

      if (sourceTypeRef.current === 'youtube' && ytPlayerRef.current && isYtReadyRef.current && !isVideoModeRef.current) {
        try {
          ytPlayerRef.current.playVideo();
        } catch {}
      } else if (sourceTypeRef.current === 'audio' && audioRef.current && !isVideoModeRef.current) {
        audioRef.current.play().catch(() => {});
      } else if (currentTrack) {
        playTrack(currentTrack);
      }
      setIsPlaying(true);
      isPlayingRef.current = true;
    }
  };

  const seek = (seconds: number) => {
    const clamped = Math.max(0, Math.min(durationRef.current || 300, seconds));
    setCurrentTime(clamped);
    clockStartOffsetRef.current = clamped;
    clockStartTimestampRef.current = Date.now();
    lastYtReportedTimeRef.current = clamped;

    if (sourceTypeRef.current === 'youtube' && ytPlayerRef.current && isYtReadyRef.current) {
      try {
        ytPlayerRef.current.seekTo(clamped, true);
      } catch {}
    } else if (audioRef.current) {
      audioRef.current.currentTime = clamped;
    }
  };

  const setVolume = (val: number) => {
    const clamped = Math.max(0, Math.min(100, val));
    setVolumeState(clamped);
    if (isMuted) setIsMuted(false);

    if (ytPlayerRef.current && isYtReadyRef.current) {
      try {
        ytPlayerRef.current.setVolume(clamped);
        ytPlayerRef.current.unMute();
      } catch {}
    }
    if (audioRef.current) {
      audioRef.current.volume = clamped / 100;
      audioRef.current.muted = false;
    }
  };

  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      if (ytPlayerRef.current && isYtReadyRef.current) {
        try {
          ytPlayerRef.current.unMute();
          ytPlayerRef.current.setVolume(volumeRef.current);
        } catch {}
      }
      if (audioRef.current) audioRef.current.muted = false;
    } else {
      setIsMuted(true);
      if (ytPlayerRef.current && isYtReadyRef.current) {
        try {
          ytPlayerRef.current.mute();
        } catch {}
      }
      if (audioRef.current) audioRef.current.muted = true;
    }
  };

  const nextTrack = () => {
    if (!currentTrack || queueRef.current.length === 0) return;
    const currentIndex = queueRef.current.findIndex((t) => t.id === currentTrack.id);
    let nextIndex = currentIndex + 1;

    if (nextIndex >= queueRef.current.length) {
      if (repeatModeRef.current === 'all') {
        nextIndex = 0;
      } else {
        setIsPlaying(false);
        isPlayingRef.current = false;
        return;
      }
    }

    if (isShuffle && queueRef.current.length > 1) {
      nextIndex = Math.floor(Math.random() * queueRef.current.length);
    }

    const next = queueRef.current[nextIndex];
    if (next) {
      playTrack(next);
    }
  };

  const prevTrack = () => {
    if (currentTime > 3) {
      seek(0);
      return;
    }
    if (!currentTrack || queueRef.current.length === 0) return;
    const currentIndex = queueRef.current.findIndex((t) => t.id === currentTrack.id);
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : queueRef.current.length - 1;
    const prev = queueRef.current[prevIndex];
    if (prev) {
      playTrack(prev);
    }
  };

  const toggleRepeat = () => {
    setRepeatMode((prev) => {
      if (prev === 'off') return 'all';
      if (prev === 'all') return 'one';
      return 'off';
    });
  };

  const toggleShuffle = () => {
    setIsShuffle((prev) => !prev);
  };

  const addToQueue = (track: Track) => {
    setQueue((prev) => {
      if (prev.some((t) => t.id === track.id)) return prev;
      return [...prev, track];
    });
  };

  return (
    <AudioContext.Provider
      value={{
        currentTrack,
        isPlaying,
        currentTime,
        duration,
        volume,
        isMuted,
        queue,
        history,
        repeatMode,
        isShuffle,
        isGrabbing,
        sourceType,
        youtubeUrl,
        activeVideoId,
        musicVideoId,
        isVideoMode,
        setIsVideoMode,
        switchVideoSource,
        reparentYtPlayer,
        playTrack,
        togglePlay,
        seek,
        setVolume,
        toggleMute,
        nextTrack,
        prevTrack,
        toggleRepeat,
        toggleShuffle,
        addToQueue,
        playDirectUrl,
        isExpandedPlayer,
        setIsExpandedPlayer,
        savedTracks,
        toggleSaveTrack,
        isTrackSaved,
        toggleFavorite: toggleSaveTrack,
        isFavorite: isTrackSaved,
        trackSources,
        currentSourceId,
        switchTrackSource,
        getTrackDuration,
        trackDurationsMap,
      }}
    >
      {children}
    </AudioContext.Provider>
  );
};

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
};
