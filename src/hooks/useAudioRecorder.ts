import { useState, useRef } from "react";
import OpenAI from "openai";

interface UseAudioRecorderProps {
  openai: OpenAI | null; // 👈여기에 ' | null' 을 추가하세요!
  setInputText: React.Dispatch<React.SetStateAction<string>>;
}

export function useAudioRecorder({ openai, setInputText }: UseAudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);

  const startRecording = async () => {
    if (!openai) {
      alert("OpenAI API 키가 설정되지 않았습니다. ⚙️ 시스템 설정에서 먼저 키를 등록해 주세요.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await transcribeAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("마이크 접근 실패:", error);
      alert("마이크 권한을 허용해 주시거나 마이크가 연결되어 있는지 확인해 주세요.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
    }
  };

  const transcribeAudio = async (blob: Blob) => {
    if (!openai) {
      console.error("🚨 OpenAI API 키가 없습니다. 시스템 설정에서 등록해주세요.");
      return;
    }
    try {
      const file = new File([blob], "voice.webm", { type: 'audio/webm' });
      const response = await openai.audio.transcriptions.create({
        file: file,
        model: "whisper-1",
        language: "ko",
      });

      if (response.text) {
        setInputText(prev => prev + (prev ? " " : "") + response.text);
      }
    } catch (error) {
      console.error("음성 변환 실패:", error);
    }
  };

  return { isRecording, startRecording, stopRecording };
}