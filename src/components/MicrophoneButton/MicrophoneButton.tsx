import React, { useEffect, useRef, useState } from 'react';
import { usePermission } from 'react-use';
import { Button } from '@/ui-kit';
import { MicIcon, SquareIcon } from 'lucide-react';
import { openMediaOnboardingTab } from '@/helpers';
import { handleIntent } from '@/helpers/handleIntent';
import { Intent } from '@/types';
import { useAtomValue } from 'jotai';
import {
  validatorDataAtom,
  symphonyAssetsAtom,
  subscribedChainRegistryAtom,
  chainWalletAtom,
} from '@/atoms';
import { useRefreshData } from '@/hooks';
import { SYMPHONY_MAINNET_ID } from '@/constants';

export const MicrophoneButton: React.FC = () => {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const { refreshData } = useRefreshData();

  const wallet = useAtomValue(chainWalletAtom(SYMPHONY_MAINNET_ID));
  const validators = useAtomValue(validatorDataAtom);
  const symphonyAssets = useAtomValue(symphonyAssetsAtom);
  const chainRegistry = useAtomValue(subscribedChainRegistryAtom);

  const [micStatus, setMicStatus] = useState<'neutral' | 'granted' | 'denied'>('neutral');
  const [isRecording, setIsRecording] = useState(false);
  const [, setAudioUrl] = useState<string | null>(null);
  const [, setTranscript] = useState<string | null>(null);
  const [, setIntent] = useState<Intent | null>(null);

  const permissionState = usePermission({ name: 'microphone' });
  const micGranted = permissionState === 'granted';

  const attemptMicAccess = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      setMicStatus('granted');
    } catch (err: any) {
      console.error('Mic error:', err);
      setMicStatus('denied');
      if (err.name === 'NotAllowedError') openMediaOnboardingTab();
    }
  };

  const sendToIntentParser = async (audioBlob: Blob) => {
    console.log('Sending audio to intent-parser', audioBlob);

    // TODO: get chain ID from asset sending, from audio, or from managed state
    const chain = chainRegistry.mainnet[SYMPHONY_MAINNET_ID];
    const prefix = chain.bech32_prefix;
    const restUris = chain.rest_uris;
    const rpcUris = chain.rpc_uris;

    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.webm');

    try {
      const res = await fetch('http://localhost:3001/transcribe', {
        method: 'POST',
        body: formData,
      });

      const text = await res.text();
      console.log('Raw response:', text);

      try {
        const data = JSON.parse(text);
        console.log('Transcription:', data.text);
        console.log('Parsed Intent:', data.parsedIntent);
        setTranscript(data.text || 'No result');

        if (data.parsedIntent) {
          setIntent(data.parsedIntent);
          const result = await handleIntent(data.parsedIntent as Intent, {
            address: wallet?.address || '',
            walletAssets: wallet?.assets || [],
            validators: validators || [],
            symphonyAssets: symphonyAssets || [],
            prefix,
            restUris: restUris,
            rpcUris,
          });

          if (result) {
            await refreshData({ address: wallet?.address });
          }
        } else {
          setIntent(null);
        }
      } catch (e) {
        console.error('Failed to parse JSON:', e);
        setTranscript('Invalid response');
        setIntent(null);
      }
    } catch (error) {
      console.error('Failed to transcribe:', error);
      setTranscript('Error during transcription');
      setIntent(null);
    }
  };

  const startRecording = async () => {
    console.log('Start button pressed');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      setAudioUrl(null);
      setTranscript(null);
      setIntent(null);

      recorder.ondataavailable = event => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        console.log('Recording stopped, building blob...');
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        console.log('Sending to parser...');
        void sendToIntentParser(audioBlob);
      };

      recorder.start();
      console.log('Recording started');
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording:', err);
    }
  };

  const stopRecording = () => {
    console.log('Stop button pressed');
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  useEffect(() => {
    if (micGranted) setMicStatus('granted');
  }, [micGranted]);

  return (
    <div className="flex flex-col items-center space-y-2">
      <Button
        onClick={
          micStatus !== 'granted' ? attemptMicAccess : isRecording ? stopRecording : startRecording
        }
        size="small"
        variant={isRecording ? 'destructive' : 'secondary'}
      >
        {isRecording ? (
          <>
            <SquareIcon className="mr-2 h-4 w-4" /> Stop Recording
          </>
        ) : (
          <>
            <MicIcon className="mr-2 h-4 w-4" />
            {micStatus !== 'granted' ? 'Enable Microphone' : 'Start Recording'}
          </>
        )}
      </Button>

      {/* {audioUrl && (
        <div className="flex flex-col items-center space-y-1">
          <audio controls src={audioUrl} className="mt-2" />
          <Button size="tiny" variant="ghost" onClick={() => new Audio(audioUrl).play()}>
            <PlayIcon className="mr-2 h-4 w-4" /> Play Again
          </Button>
        </div>
      )}

      {transcript && (
        <div className="text-sm text-gray-300 max-w-xs text-center whitespace-pre-wrap">
          <strong>Transcript:</strong> {transcript}
        </div>
      )}

      {intent && (
        <pre className="text-xs text-blue-400 max-w-xs whitespace-pre-wrap break-words text-left">
          <strong>Intent:</strong> {JSON.stringify(intent, null, 2)}
        </pre>
      )} */}

      {micStatus === 'granted' && (
        <span className="text-xs text-green-500">Microphone enabled</span>
      )}
      {micStatus === 'denied' && <span className="text-xs text-red-500">Microphone blocked</span>}
    </div>
  );
};
