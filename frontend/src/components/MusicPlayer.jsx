import { useEffect, useRef, useState } from 'react';

let activeAudio = null;

function formatTime(value) {
  if (!Number.isFinite(value)) return '0:00';
  return `${Math.floor(value / 60)}:${Math.floor(value % 60).toString().padStart(2, '0')}`;
}

export default function MusicPlayer({ src, cover }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onDurationChange = () => setDuration(audio.duration);
    const onPause = () => setPlaying(false);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onDurationChange);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onPause);
    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onDurationChange);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onPause);
      if (activeAudio === audio) activeAudio = null;
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.src = src;
    audio.load();
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, [src]);

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      if (activeAudio && activeAudio !== audio) activeAudio.pause();
      activeAudio = audio;
      try {
        await audio.play();
        setPlaying(true);
      } catch {
        setPlaying(false);
      }
    } else {
      audio.pause();
    }
  }

  function seek(event) {
    const nextTime = Number(event.target.value);
    audioRef.current.currentTime = nextTime;
    setCurrentTime(nextTime);
  }

  const progress = duration ? (currentTime / duration) * 100 : 0;
  const waveform = [18, 28, 22, 36, 44, 30, 52, 40, 64, 48, 74, 56, 88, 62, 78, 48, 68, 38, 58, 30, 46, 24, 34, 20];

  return (
    <div className={`music-player${playing ? ' is-playing' : ''}`}>
      <audio ref={audioRef} preload="metadata" aria-hidden="true" />
      {cover && <div className="music-cover-trigger">{cover}</div>}
      <div className="music-player-controls">
        <button type="button" className="music-toggle" onClick={togglePlayback} aria-label={playing ? 'Duraklat' : 'Oynat'}>{playing ? <PauseIcon /> : <PlayIcon />}</button>
        <button type="button" className="music-skip" onClick={() => { if (audioRef.current) audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10); }} aria-label="Önceki bölüm"><PreviousIcon /></button>
        <div className="music-visual-area"><div className="music-waveform" aria-hidden="true">{waveform.map((height, index) => <span key={index} className={duration && (index / waveform.length) * 100 <= progress ? 'is-active' : ''} style={{ height: `${height}%` }} />)}</div><input className="music-progress" type="range" min="0" max={duration || 0} step="0.01" value={Math.min(currentTime, duration || 0)} onChange={seek} style={{ '--progress': `${progress}%` }} aria-label="Şarkı ilerlemesi" /><div className="music-times"><span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span></div></div>
        <button type="button" className="music-skip" onClick={() => { if (audioRef.current) audioRef.current.currentTime = Math.min(duration || 0, audioRef.current.currentTime + 10); }} aria-label="Sonraki bölüm"><NextIcon /></button>
      </div>
    </div>
  );
}

function PlayIcon() { return <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false"><path d="M5 3.2v9.6L12.2 8 5 3.2Z" fill="currentColor" /></svg>; }
function PauseIcon() { return <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false"><path d="M4.2 3.5h2.5v9H4.2v-9Zm5.1 0h2.5v9H9.3v-9Z" fill="currentColor" /></svg>; }
function PreviousIcon() { return <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" focusable="false"><path d="M4 3.5v9m1.7-4.5 6 4.2V3.8l-6 4.2Z" fill="currentColor" /></svg>; }
function NextIcon() { return <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" focusable="false"><path d="M12 3.5v9M10.3 8l-6-4.2v8.4l6-4.2Z" fill="currentColor" /></svg>; }
