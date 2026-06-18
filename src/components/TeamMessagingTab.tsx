"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import * as dbActions from "@/lib/actions/db.actions";
import { useAuth } from "@/contexts/AuthContext";
import { Conversation, ChatMessage, UserProfile } from "@/types";
import {
  Send,
  Paperclip,
  Image as ImageIcon,
  FileText,
  Search,
  Users,
  MoreVertical,
  ChevronLeft,
  Loader2,
  User as UserIcon,
  Building2,
  Trash2,
  Smile,
  X,
  Plus
} from "lucide-react";

interface TeamMessagingTabProps {
  companyId: string;
  setError: (msg: string) => void;
  setSuccess: (msg: string) => void;
}

export default function TeamMessagingTab({ companyId, setError, setSuccess }: TeamMessagingTabProps) {
  const { user: currentUser, userProfile } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [staff, setStaff] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [showPeopleList, setShowPeopleList] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [uploading, setUploading] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Initial Fetch ──────────────────────────────────────────────────────────
  
  const fetchInitialData = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const [convRes, staffRes] = await Promise.all([
        dbActions.getConversations(currentUser.id),
        dbActions.getStaffMembers(companyId, currentUser.id)
      ]);

      if (convRes.success) {
        setConversations(convRes.data as Conversation[]);
      }
      if (staffRes.success) {
        setStaff(staffRes.data as UserProfile[]);
      }
      
      // Auto-select broadcast if it exists, or create/select it
      const broadcast = convRes.data?.find((c: any) => c.isBroadcast);
      if (broadcast) {
        setActiveConversation(broadcast);
      } else if (userProfile?.role === 'company_admin' || userProfile?.role === 'superadmin') {
        // Only admin can create the broadcast channel if it doesn't exist
        const newBroadcast = await dbActions.createConversation({
          companyId,
          participantIds: [currentUser.id, ...staffRes.data?.map((s: any) => s.id) || []],
          name: "Company General",
          isBroadcast: true
        });
        if (newBroadcast.success) {
          setConversations(prev => [newBroadcast.data as Conversation, ...prev]);
          setActiveConversation(newBroadcast.data as Conversation);
        }
      }
    } catch (err: any) {
      setError("Failed to initialize messaging hub");
    } finally {
      setLoading(false);
    }
  }, [currentUser, companyId, userProfile?.role, setError]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // ─── Fetch Messages ────────────────────────────────────────────────────────
  
  const fetchMessages = useCallback(async (convId: string) => {
    setMessagesLoading(true);
    try {
      const res = await dbActions.getMessages(convId);
      if (res.success) {
        setMessages(res.data as ChatMessage[]);
      }
    } catch (err) {
      setError("Failed to load history");
    } finally {
      setMessagesLoading(false);
    }
  }, [setError]);

  useEffect(() => {
    if (activeConversation) {
      fetchMessages(activeConversation.id);
      
      // Subscribe to real-time messages
      const channel = supabase
        .channel(`chat-${activeConversation.id}`)
        .on(
          "postgres_changes",
          { 
            event: "INSERT", 
            schema: "public", 
            table: "ChatMessage", 
            filter: `conversationId=eq.${activeConversation.id}` 
          },
          (payload) => {
            const newMsg = payload.new as ChatMessage;
            // If we are the sender, we might already have it in state (pessimistic update handled below)
            // But for others, we need to fetch sender info or just append if payload is complete
            // For simplicity, we re-fetch the latest batch or just the single message if we can
            refreshActiveMessages();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [activeConversation, fetchMessages]);

  const refreshActiveMessages = async () => {
    if (!activeConversation) return;
    const res = await dbActions.getMessages(activeConversation.id);
    if (res.success) {
      setMessages(res.data as ChatMessage[]);
    }
  };

  // ─── Auto-scroll ───────────────────────────────────────────────────────────
  
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // ─── Actions ───────────────────────────────────────────────────────────────

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeConversation || !currentUser || (!newMessage.trim() && !uploading)) return;

    setSending(true);
    const content = newMessage.trim();
    setNewMessage("");

    try {
      const res = await dbActions.sendMessage({
        conversationId: activeConversation.id,
        senderId: currentUser.id,
        content: content
      });

      if (!res.success) throw new Error(res.error);
      // Real-time listener will pick it up, or we can manually append for speed
      refreshActiveMessages();
    } catch (err: any) {
      setError("Transmission failure");
      setNewMessage(content); // Restore
    } finally {
      setSending(false);
    }
  };

  const startPrivateChat = async (targetUser: UserProfile) => {
    if (!currentUser) return;
    try {
      setLoading(true);
      const res = await dbActions.createConversation({
        companyId,
        participantIds: [currentUser.id, targetUser.id]
      });
      if (res.success) {
        const conv = res.data as Conversation;
        if (!conversations.find(c => c.id === conv.id)) {
          setConversations(prev => [conv, ...prev]);
        }
        setActiveConversation(conv);
        setShowPeopleList(false);
      }
    } catch (err) {
      setError("Failed to initiate secure connection");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeConversation || !currentUser) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `chats/${activeConversation.id}/${fileName}`;

      const { error: uploadError, data } = await supabase.storage
        .from('messaging-media')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('messaging-media')
        .getPublicUrl(filePath);

      await dbActions.sendMessage({
        conversationId: activeConversation.id,
        senderId: currentUser.id,
        content: file.name,
        mediaUrl: publicUrl,
        mediaType: file.type.startsWith('image/') ? 'image' : 'file'
      });

      refreshActiveMessages();
      setSuccess("Media deployed");
    } catch (err: any) {
      setError("Media upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ─── Helpers ───────────────────────────────────────────────────────────────

  const getPartner = (conv: Conversation) => {
    if (conv.isBroadcast) return { firstName: "Company", lastName: "General" };
    return conv.participants.find(p => p.id !== currentUser?.id) || { firstName: "Unknown", lastName: "User" };
  };

  const getInitials = (user: any) => {
    return `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase();
  };

  const filteredStaff = staff.filter(s => 
    `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ─── RENDER ────────────────────────────────────────────────────────────────
  
  if (loading && !activeConversation) {
    return (
      <div className="flex h-[calc(100vh-200px)] items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-indigo-200" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-140px)] sm:h-[calc(100vh-180px)] bg-white rounded-2xl shadow-2xl shadow-gray-200/50 border border-gray-100 overflow-hidden text-left">
      
      {/* ── Sidebar ── */}
      <div className={`w-full sm:w-80 border-r border-gray-50 flex flex-col bg-gray-50/30 ${activeConversation && !showPeopleList ? 'hidden sm:flex' : 'flex'}`}>
        <div className="p-6 border-b border-gray-50 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 tracking-tight uppercase">Signals</h2>
          <button 
            onClick={() => setShowPeopleList(!showPeopleList)}
            className="p-2.5 bg-white rounded-xl shadow-sm border border-gray-100 text-indigo-600 hover:scale-110 transition-transform active:scale-95"
          >
            {showPeopleList ? <ChevronLeft className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
          </button>
        </div>

        {showPeopleList ? (
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search personnel..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-100 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-600 outline-none"
              />
            </div>
            {filteredStaff.map(member => (
              <button
                key={member.id}
                onClick={() => startPrivateChat(member)}
                className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-100 transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-xs font-bold text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  {getInitials(member)}
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-gray-900 uppercase tracking-tight">{member.firstName} {member.lastName}</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{member.role}</p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {conversations.map(conv => {
              const partner = getPartner(conv);
              const isActive = activeConversation?.id === conv.id;
              const lastMsg = conv.messages?.[0];
              
              return (
                <button
                  key={conv.id}
                  onClick={() => setActiveConversation(conv)}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all relative overflow-hidden group ${
                    isActive 
                      ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' 
                      : 'bg-white border border-gray-100 hover:border-indigo-100 hover:shadow-lg'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-bold shrink-0 ${
                    isActive ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-600'
                  }`}>
                    {conv.isBroadcast ? <Building2 className="w-6 h-6" /> : getInitials(partner)}
                  </div>
                  <div className="text-left min-w-0">
                    <p className={`text-xs font-bold uppercase tracking-tight truncate ${isActive ? 'text-white' : 'text-gray-900'}`}>
                      {conv.isBroadcast ? "Company General" : `${partner.firstName} ${partner.lastName}`}
                    </p>
                    <p className={`text-[10px] font-bold truncate mt-1 ${isActive ? 'text-white/60' : 'text-gray-400'}`}>
                      {lastMsg ? (lastMsg.mediaUrl ? "📎 Attachment" : lastMsg.content) : "Initialize secure link..."}
                    </p>
                  </div>
                  {isActive && <div className="absolute right-4 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white animate-pulse" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Chat Window ── */}
      <div className={`flex-1 flex flex-col min-w-0 ${!activeConversation || showPeopleList ? 'hidden sm:flex' : 'flex'}`}>
        {activeConversation ? (
          <>
            {/* Header */}
            <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-white/50 backdrop-blur-md sticky top-0 z-10">
              <div className="flex items-center gap-4">
                <button onClick={() => setActiveConversation(null)} className="sm:hidden p-2 hover:bg-gray-50 rounded-lg">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-xs font-bold text-white shadow-lg shadow-indigo-100">
                  {activeConversation.isBroadcast ? <Building2 className="w-5 h-5" /> : getInitials(getPartner(activeConversation))}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-tight">
                    {activeConversation.isBroadcast ? "Company General" : `${getPartner(activeConversation).firstName} ${getPartner(activeConversation).lastName}`}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Active Signal</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                 <button className="p-2.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
                   <MoreVertical className="w-5 h-5" />
                 </button>
              </div>
            </div>

            {/* Messages */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/10"
            >
              {messagesLoading ? (
                <div className="flex flex-col items-center justify-center h-full opacity-30">
                  <Loader2 className="w-8 h-8 animate-spin mb-2" />
                  <p className="text-[10px] font-bold uppercase tracking-widest">Decrypting Archive</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full space-y-4 opacity-20">
                   <div className="w-20 h-20 bg-indigo-50 rounded-2xl flex items-center justify-center border border-indigo-100">
                      <Send className="w-10 h-10 text-indigo-200" />
                   </div>
                   <p className="text-[11px] font-bold uppercase tracking-widest">No signals identified in this corridor</p>
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const isMine = msg.senderId === currentUser?.id;
                  const showSender = activeConversation.isBroadcast && !isMine;
                  
                  return (
                    <div key={msg.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                      {showSender && (
                        <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest mb-1.5 ml-1">
                          {msg.sender?.firstName} {msg.sender?.lastName} • {msg.sender?.role}
                        </p>
                      )}
                      <div className={`max-w-[85%] sm:max-w-[70%] rounded-2xl p-4 shadow-sm relative group ${
                        isMine 
                          ? 'bg-indigo-600 text-white rounded-br-none' 
                          : 'bg-white border border-gray-100 text-gray-900 rounded-bl-none'
                      }`}>
                        {msg.mediaUrl ? (
                          <div className="space-y-2">
                             {msg.mediaType === 'image' ? (
                               <img src={msg.mediaUrl} alt="Media" className="rounded-2xl max-h-64 w-full object-cover shadow-inner" />
                             ) : (
                               <a href={msg.mediaUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 bg-gray-50/10 rounded-xl hover:bg-gray-50/20 transition-all border border-white/10">
                                 <FileText className="w-5 h-5" />
                                 <span className="text-[11px] font-bold truncate max-w-[150px]">{msg.content || "Attachment"}</span>
                               </a>
                             )}
                          </div>
                        ) : (
                          <p className="text-[13px] leading-relaxed font-bold tracking-tight">{msg.content}</p>
                        )}
                        <p className={`text-[8px] font-bold uppercase tracking-widest mt-2 opacity-50 ${isMine ? 'text-right' : ''}`}>
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Input Bar */}
            <div className="p-6 bg-white border-t border-gray-50">
              <form onSubmit={handleSend} className="flex items-end gap-4">
                <div className="flex-1 bg-gray-50 border border-gray-100 rounded-2xl p-2 flex items-end gap-2 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-600 transition-all">
                  <button 
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-3 text-gray-400 hover:text-indigo-600 transition-colors"
                  >
                    {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
                  </button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    onChange={handleFileUpload}
                  />
                  <textarea
                    rows={1}
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder="Type a secure signal..."
                    className="flex-1 bg-transparent border-none outline-none py-3 text-sm font-bold text-gray-900 resize-none max-h-32"
                  />
                  <button type="button" className="p-3 text-gray-400 hover:text-indigo-600 transition-colors">
                    <Smile className="w-5 h-5" />
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={sending || (!newMessage.trim() && !uploading)}
                  className="p-4 bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50"
                >
                  {sending ? <Loader2 className="w-6 h-6 animate-spin" /> : <Send className="w-6 h-6" />}
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 space-y-6 bg-gray-50/10 text-center">
            <div className="w-32 h-32 bg-indigo-50 rounded-[3rem] flex items-center justify-center border-2 border-dashed border-indigo-200">
               <Users className="w-12 h-12 text-indigo-300" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 uppercase tracking-tight">Messaging Hub Ready</h3>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-2 max-w-xs">
                Select a signal thread or initiate a secure private link with personnel.
              </p>
            </div>
            <button 
              onClick={() => setShowPeopleList(true)}
              className="px-8 py-3 bg-white border border-gray-100 rounded-2xl text-[11px] font-bold uppercase tracking-widest text-indigo-600 shadow-sm hover:shadow-xl hover:scale-105 transition-all active:scale-95"
            >
              Explore Personnel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
