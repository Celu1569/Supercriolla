import React, { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { MessageSquare, Send, Mic, Paperclip, X, Play, Pause, File, User, ShieldCheck, Clock, Phone } from 'lucide-react';
import { ChatConfig, ChatMessage } from '../types';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage, db } from '../firebase';
import { v4 as uuidv4 } from 'uuid';

interface ChatProps {
  config: ChatConfig;
}

const Chat: React.FC<ChatProps> = ({ config }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [userName, setUserName] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [hasJoined, setHasJoined] = useState(false);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Connect directly to Firestore (Netlify friendly way)
    const messagesRef = collection(db, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'), limit(100));

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const fbMessages = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as ChatMessage[];
        
        // Sorting locally just in case Firestore delay
        const sorted = fbMessages.sort((a, b) => {
            const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
            const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
            return timeA - timeB;
        });
        
        setMessages(sorted);
    }, (error) => {
      console.error('Firestore Chat Error:', error);
    });

    return () => {
      unsubscribe();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (userName.trim() && (!config.requirePhone || userPhone.trim())) {
      setHasJoined(true);
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    const message: any = {
      sender: userName,
      senderPhone: userPhone,
      text: inputText,
      isAdmin: false,
      timestamp: new Date().toISOString(),
      createdAt: serverTimestamp()
    };

    try {
        await addDoc(collection(db, 'messages'), message);
        setInputText('');
    } catch(err) {
        console.error("Error sending message to Firestore:", err);
        alert("No se pudo enviar el mensaje.");
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        try {
          setUploading(true);
          const fileName = `${uuidv4()}.webm`;
          const storageRef = ref(storage, `chat_audio/${fileName}`);
          const snapshot = await uploadBytesResumable(storageRef, audioBlob);
          const downloadURL = await getDownloadURL(snapshot.ref);

          const message: any = {
            sender: userName,
            senderPhone: userPhone,
            audioUrl: downloadURL,
            isAdmin: false,
            timestamp: new Date().toISOString(),
            createdAt: serverTimestamp()
          };
          
          await addDoc(collection(db, 'messages'), message);
        } catch (err: any) {
            console.error("Error uploading audio to Firebase:", err);
            if (err?.code === 'storage/unauthorized') {
                 alert("Error de Permisos: El administrador aún no ha habilitado el envío de audios.");
            } else {
                 alert("No se pudo subir el audio. Revisa tu conexión o permisos.");
            }
        } finally {
            setUploading(false);
        }

        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      alert('No se pudo acceder al micrófono. Por favor, verifica los permisos.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
        setUploading(true);
        const fileName = `${uuidv4()}_${file.name}`;
        const storageRef = ref(storage, `chat_files/${fileName}`);
        const snapshot = await uploadBytesResumable(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);

        const message: any = {
          sender: userName,
          senderPhone: userPhone,
          fileUrl: downloadURL,
          fileName: file.name,
          isAdmin: false,
          timestamp: new Date().toISOString(),
          createdAt: serverTimestamp()
        };
        
        await addDoc(collection(db, 'messages'), message);
    } catch(err: any) {
        console.error("Error uploading file to Firebase:", err);
        if (err?.code === 'storage/unauthorized') {
            alert("Error de Permisos: El administrador del sitio web aún no ha habilitado el envío de archivos en almacenamiento.");
        } else {
            alert("No se pudo subir el archivo. Revisa tu conexión o permisos.");
        }
    } finally {
        setUploading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!config.enabled) return null;

  if (!hasJoined) {
    return (
      <div 
        className="max-w-md mx-auto p-8 rounded-2xl shadow-xl border border-white/10 animate-fade-in"
        style={{ backgroundColor: config.containerBg || '#030712', color: config.textColor || '#ffffff' }}
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-green-500/20">
            <MessageSquare className="text-white" size={32} />
          </div>
          <h2 className="text-2xl font-bold mb-2">{config.title}</h2>
          <p className="opacity-70 text-sm">{config.description}</p>
        </div>

        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold opacity-50 uppercase mb-2 tracking-wider">Tu Nombre o Alias</label>
            <input 
              type="text" 
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Ej. Juan Pérez"
              className="w-full border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-green-500 outline-none transition-all"
              style={{ backgroundColor: config.inputBg || '#111827', color: config.textColor || '#ffffff' }}
              required
            />
          </div>
          {config.requirePhone && (
            <div>
              <label className="block text-xs font-bold opacity-50 uppercase mb-2 tracking-wider">Tu Número de Celular</label>
              <input 
                type="tel" 
                value={userPhone}
                onChange={(e) => setUserPhone(e.target.value)}
                placeholder="Ej. +507 6000-0000"
                className="w-full border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-green-500 outline-none transition-all"
                style={{ backgroundColor: config.inputBg || '#111827', color: config.textColor || '#ffffff' }}
                required={config.requirePhone}
              />
              <p className="text-[10px] opacity-50 mt-1 italic">Lo usaremos para contactarte en caso de premios y promociones.</p>
            </div>
          )}
          <button 
            type="submit"
            className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-green-500/20 transition-all transform active:scale-95"
          >
            Entrar al Chat
          </button>
        </form>
      </div>
    );
  }

  return (
    <div 
      className="max-w-4xl mx-auto h-[600px] flex flex-col rounded-2xl shadow-2xl border border-white/10 overflow-hidden animate-fade-in"
      style={{ backgroundColor: config.containerBg || '#030712', color: config.textColor || '#ffffff' }}
    >
      {/* Chat Header */}
      <div 
        className="p-4 border-b border-white/10 flex items-center justify-between"
        style={{ backgroundColor: config.inputBg || '#111827' }}
      >
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white shadow-inner">
            <User size={20} />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm">{config.title}</h3>
            <div className="flex items-center text-[10px] text-green-500">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></span>
              En línea
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {config.phoneNumber && (
            <a 
              href={`https://wa.me/${config.phoneNumber.replace(/[^0-9]/g, '')}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center space-x-1 bg-green-600 hover:bg-green-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-full transition-all shadow-lg"
            >
              <Phone size={12} />
              <span>WhatsApp Directo</span>
            </a>
          )}
          <button onClick={() => setHasJoined(false)} className="p-2 text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div 
        className="flex-1 overflow-y-auto p-4 space-y-4 bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat opacity-90 custom-scrollbar"
        style={{ backgroundColor: config.messagesBg || '#030712' }}
      >
        {messages.map((msg) => {
          const isMe = msg.sender === userName;
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-slide-up`}>
              <div 
                className={`max-w-[80%] rounded-2xl px-4 py-2 shadow-sm relative ${
                  isMe 
                    ? 'rounded-tr-none' 
                    : 'rounded-tl-none'
                }`}
                style={{ 
                  backgroundColor: msg.isAdmin ? config.primaryColor : (isMe ? config.backgroundColor : '#1f2937'),
                  color: (isMe || msg.isAdmin) ? '#000' : '#fff'
                }}
              >
                {!isMe && (
                  <div className="text-[10px] font-bold mb-1 flex items-center">
                    {msg.sender}
                    {msg.isAdmin && <ShieldCheck size={10} className="ml-1 text-blue-500" />}
                  </div>
                )}
                
                {msg.text && <p className="text-sm leading-relaxed">{msg.text}</p>}
                
                {msg.audioUrl && (
                  <div className="flex items-center space-x-2 py-1">
                    <div className="w-8 h-8 rounded-full bg-black/10 flex items-center justify-center">
                      <Play size={14} />
                    </div>
                    <audio src={msg.audioUrl} controls className="h-8 w-40" />
                  </div>
                )}

                {msg.fileUrl && (
                  <a 
                    href={msg.fileUrl} 
                    download={msg.fileName}
                    className="flex items-center space-x-2 p-2 bg-black/5 rounded-lg hover:bg-black/10 transition-all"
                  >
                    <File size={20} />
                    <div className="overflow-hidden">
                      <div className="text-xs font-bold truncate">{msg.fileName}</div>
                      <div className="text-[10px] opacity-60">Descargar archivo</div>
                    </div>
                  </a>
                )}

                <div className={`text-[9px] mt-1 text-right opacity-50 flex items-center justify-end`}>
                  <Clock size={8} className="mr-1" />
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div 
        className="p-4 border-t border-white/10"
        style={{ backgroundColor: config.inputBg || '#111827' }}
      >
        {uploading && (
            <div className="flex items-center justify-center space-x-2 text-xs text-green-500 mb-2 animate-pulse">
                <div className="w-3 h-3 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                <span>Subiendo archivo...</span>
            </div>
        )}
        <div className="flex items-center space-x-2">
          {config.allowFiles && (
            <label className={`p-2 text-gray-400 hover:text-green-500 cursor-pointer transition-colors ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
              <Paperclip size={20} />
              <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
            </label>
          )}
          
          <div className="flex-1 relative">
            {isRecording ? (
                <div className="flex items-center space-x-2 w-full border border-red-500/50 bg-red-500/10 rounded-full px-4 py-2">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                    <span className="text-red-400 text-sm font-bold flex-1">Grabando... {formatTime(recordingTime)}</span>
                    <button onClick={stopRecording} className="text-red-500 hover:text-red-400 uppercase text-xs font-bold">
                        Detener y Enviar
                    </button>
                </div>
            ) : (
                <input 
                  type="text" 
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Escribe un mensaje..."
                  className="w-full border border-white/5 rounded-full px-4 py-2 text-sm focus:border-green-500 outline-none transition-all"
                  style={{ backgroundColor: config.containerBg || '#030712', color: config.textColor || '#ffffff' }}
                  disabled={uploading}
                />
            )}
          </div>

          {config.allowVoiceNotes && (
            <button 
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
              disabled={uploading}
              className={`p-3 rounded-full transition-all ${
                isRecording ? 'bg-red-500 text-white animate-pulse scale-110' : 'text-gray-400 hover:text-green-500'
              } ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
              style={{ backgroundColor: !isRecording ? (config.containerBg || '#030712') : undefined }}
            >
              <Mic size={20} />
            </button>
          )}

          <button 
            onClick={handleSendMessage}
            disabled={!inputText.trim() || uploading}
            className={`p-3 rounded-full transition-all ${
              inputText.trim() && !uploading ? 'bg-green-500 text-white shadow-lg shadow-green-500/20' : 'text-gray-600'
            }`}
            style={{ backgroundColor: (!inputText.trim() || uploading) ? (config.containerBg || '#030712') : undefined }}
          >
            <Send size={20} />
          </button>
        </div>
        {isRecording && (
          <div className="text-center mt-2">
            <span className="text-xs text-red-500 font-bold animate-pulse">Grabando: {formatTime(recordingTime)}</span>
            <p className="text-[10px] text-gray-500">Suelta para enviar</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Chat;
