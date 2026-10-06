"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AppMode, NoteItem, VideoItem, CategoryItem, PaperStyle, NoteColor } from "@/types";
import { NotebookHeader } from "@/components/notebook/NotebookHeader";
import { NotebookDesk } from "@/components/notebook/NotebookDesk";
import { NotebookNotesList } from "@/components/notebook/NotebookNotesList";
import { NotebookSettings } from "@/components/notebook/NotebookSettings";
import { NoteEditorModal } from "@/components/notebook/NoteEditorModal";
import { ShivaayHeader } from "@/components/shivaay/ShivaayHeader";
import { ShivaayBrowse } from "@/components/shivaay/ShivaayBrowse";
import { ShivaayVideoPlayer } from "@/components/shivaay/ShivaayVideoPlayer";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { BottomNav } from "@/components/navigation/BottomNav";
import { SecretUnlockModal } from "@/components/common/SecretUnlockModal";
import { Sparkles, BookOpen, Film } from "lucide-react";
import { sounds } from "@/lib/sound";

export default function MagicBookApp() {
  // Application Mode: "notebook" (default) or "shivaay" (secret video mode) or "admin"
  const [mode, setMode] = useState<AppMode>("notebook");

  // Navigation tabs for each mode
  const [notebookTab, setNotebookTab] = useState<string>("desk");
  const [shivaayTab, setShivaayTab] = useState<string>("home");

  // Search input state
  const [searchQuery, setSearchQuery] = useState("");

  // Secret unlock modal state
  const [isSecretModalOpen, setIsSecretModalOpen] = useState(false);

  // Data states
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [savedVideoIds, setSavedVideoIds] = useState<number[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Modals & view states
  const [editingNote, setEditingNote] = useState<NoteItem | null>(null);
  const [isNoteEditorOpen, setIsNoteEditorOpen] = useState(false);
  const [activeVideo, setActiveVideo] = useState<VideoItem | null>(null);
  const [relatedVideos, setRelatedVideos] = useState<VideoItem[]>([]);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize and load all data
  const loadAllData = useCallback(async () => {
    try {
      // Trigger initial seed if needed
      await fetch("/api/seed");

      const [notesRes, videosRes, catRes, savedRes] = await Promise.all([
        fetch("/api/notes"),
        fetch("/api/videos"),
        fetch("/api/categories"),
        fetch("/api/saved"),
      ]);

      const [notesData, videosData, catData, savedData] = await Promise.all([
        notesRes.json(),
        videosRes.json(),
        catRes.json(),
        savedRes.json(),
      ]);

      if (notesData.success) setNotes(notesData.notes);
      if (videosData.success) setVideos(videosData.videos);
      if (catData.success) setCategories(catData.categories);
      if (savedData.success) {
        setSavedVideoIds(savedData.videos.map((v: VideoItem) => v.id));
      }
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Handle Search Input in Notebook mode
  const handleNotebookSearchChange = (query: string) => {
    setSearchQuery(query);
    const trimmed = query.trim().toUpperCase();
    if (trimmed === "SHIVAAY") {
      setIsSecretModalOpen(true);
    } else if (query.trim() && notebookTab !== "notes") {
      setNotebookTab("notes");
    }
  };

  // Complete the secret unlock into SHIVAAY mode
  const handleProceedToShivaay = () => {
    setIsSecretModalOpen(false);
    setSearchQuery(""); // Clear trigger query
    setMode("shivaay");
    setShivaayTab("home");
  };

  // Switch back to normal Notebook mode
  const handleReturnToNotebook = () => {
    sounds.playPageTurn();
    setMode("notebook");
    setNotebookTab("desk");
    setSearchQuery("");
    setActiveVideo(null);
  };

  // Note CRUD actions
  const handleSaveNote = async (noteData: {
    id?: number;
    title: string;
    content: string;
    paperStyle: PaperStyle;
    color: NoteColor;
    tags: string[];
    isPinned: boolean;
  }) => {
    if (noteData.id) {
      // Update existing note
      const res = await fetch(`/api/notes/${noteData.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(noteData),
      });
      const data = await res.json();
      if (data.success) {
        setNotes((prev) =>
          prev.map((n) => (n.id === noteData.id ? data.note : n))
        );
      }
    } else {
      // Create new note
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(noteData),
      });
      const data = await res.json();
      if (data.success) {
        setNotes((prev) => [data.note, ...prev]);
      }
    }
  };

  const handleQuickSaveNote = async (title: string, content: string) => {
    const res = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        content,
        paperStyle: "parchment",
        color: "amber",
        tags: ["Quick Note"],
        isPinned: false,
      }),
    });
    const data = await res.json();
    if (data.success) {
      setNotes((prev) => [data.note, ...prev]);
    }
  };

  const handleDeleteNote = async (id: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm("Are you sure you want to discard this page?")) return;
    try {
      const res = await fetch(`/api/notes/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setNotes((prev) => prev.filter((n) => n.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleTogglePinNote = async (note: NoteItem, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const newPinned = !note.isPinned;
      const res = await fetch(`/api/notes/${note.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPinned: newPinned }),
      });
      const data = await res.json();
      if (data.success) {
        setNotes((prev) =>
          prev.map((n) => (n.id === note.id ? { ...n, isPinned: newPinned } : n))
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Video Playing & Watchlist actions
  const handleSelectVideo = async (video: VideoItem) => {
    try {
      // Fetch full details and related
      const res = await fetch(`/api/videos/${video.id}`);
      const data = await res.json();
      if (data.success) {
        setActiveVideo(data.video);
        setRelatedVideos(data.related || []);
      } else {
        setActiveVideo(video);
      }
    } catch {
      setActiveVideo(video);
    }
  };

  const handleToggleSaveVideo = async (videoId: number) => {
    try {
      const res = await fetch("/api/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.saved) {
          setSavedVideoIds((prev) => [...prev, videoId]);
        } else {
          setSavedVideoIds((prev) => prev.filter((id) => id !== videoId));
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Search filter for notes in normal mode
  const filteredNotes = notes.filter((n) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      n.title.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q) ||
      n.tags.toLowerCase().includes(q)
    );
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#17120e] text-[#f4ecd8] flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#d4af37] to-[#705218] p-0.5 mx-auto shadow-2xl flex items-center justify-center animate-pulse">
            <div className="w-full h-full bg-[#1b140f] rounded-[14px] flex items-center justify-center">
              <BookOpen className="w-7 h-7 text-[#f7dc78]" />
            </div>
          </div>
          <div className="space-y-1">
            <h2 className="font-serif text-xl font-bold tracking-tight text-[#fdf8f0]">
              Magic Book
            </h2>
            <p className="text-xs text-[#a4917d] font-serif">
              Opening the handwritten sanctum...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#14100c] text-[#ede4d8]">
      {/* ========================================================= */}
      {/* 1. NORMAL NOTEBOOK MODE                                    */}
      {/* ========================================================= */}
      {mode === "notebook" && (
        <>
          <NotebookHeader
            searchQuery={searchQuery}
            onSearchChange={handleNotebookSearchChange}
            onOpenNewNote={() => {
              setEditingNote(null);
              setIsNoteEditorOpen(true);
            }}
            onUnlockShivaay={() => setIsSecretModalOpen(true)}
            currentTab={notebookTab}
            onTabChange={setNotebookTab}
          />

          <main className="flex-1 w-full animate-page-turn">
            {notebookTab === "desk" && (
              <NotebookDesk
                notes={filteredNotes}
                onSelectNote={(note) => {
                  setEditingNote(note);
                  setIsNoteEditorOpen(true);
                }}
                onOpenNewNote={() => {
                  setEditingNote(null);
                  setIsNoteEditorOpen(true);
                }}
                onTogglePin={handleTogglePinNote}
                onDeleteNote={handleDeleteNote}
                onQuickSave={handleQuickSaveNote}
                searchQuery={searchQuery}
              />
            )}

            {notebookTab === "notes" && (
              <NotebookNotesList
                notes={filteredNotes}
                onSelectNote={(note) => {
                  setEditingNote(note);
                  setIsNoteEditorOpen(true);
                }}
                onOpenNewNote={() => {
                  setEditingNote(null);
                  setIsNoteEditorOpen(true);
                }}
                onTogglePin={handleTogglePinNote}
                onDeleteNote={handleDeleteNote}
                searchQuery={searchQuery}
              />
            )}

            {notebookTab === "search" && (
              <NotebookNotesList
                notes={filteredNotes}
                onSelectNote={(note) => {
                  setEditingNote(note);
                  setIsNoteEditorOpen(true);
                }}
                onOpenNewNote={() => {
                  setEditingNote(null);
                  setIsNoteEditorOpen(true);
                }}
                onTogglePin={handleTogglePinNote}
                onDeleteNote={handleDeleteNote}
                searchQuery={searchQuery}
              />
            )}

            {notebookTab === "settings" && (
              <NotebookSettings
                notes={notes}
                onOpenAdmin={() => setIsAdminOpen(true)}
                onUnlockShivaay={() => setIsSecretModalOpen(true)}
              />
            )}
          </main>

          {/* Bottom navigation bar for mobile Android */}
          <BottomNav
            mode="notebook"
            currentTab={notebookTab}
            onTabChange={setNotebookTab}
          />
        </>
      )}

      {/* ========================================================= */}
      {/* 2. SECRET VIDEO MODE (SHIVAAY)                             */}
      {/* ========================================================= */}
      {mode === "shivaay" && (
        <div className="min-h-screen bg-[#0e0a07] text-[#f7efe4] animate-page-turn">
          <ShivaayHeader
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onReturnToNotebook={handleReturnToNotebook}
            activeNav={shivaayTab}
            onNavChange={(tab) => {
              setShivaayTab(tab);
              setActiveVideo(null); // return to browsing if player is open
            }}
            categories={categories}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            savedCount={savedVideoIds.length}
          />

          <main className="flex-1 w-full">
            {activeVideo ? (
              <ShivaayVideoPlayer
                video={activeVideo}
                relatedVideos={relatedVideos}
                onSelectVideo={handleSelectVideo}
                onClose={() => setActiveVideo(null)}
                isSaved={savedVideoIds.includes(activeVideo.id)}
                onToggleSave={handleToggleSaveVideo}
              />
            ) : (
              <ShivaayBrowse
                videos={videos}
                categories={categories}
                savedVideoIds={savedVideoIds}
                activeNav={shivaayTab}
                searchQuery={searchQuery}
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
                onSelectVideo={handleSelectVideo}
                onToggleSave={handleToggleSaveVideo}
                onNavChange={setShivaayTab}
              />
            )}
          </main>

          {/* Bottom navigation in SHIVAAY mode */}
          <BottomNav
            mode="shivaay"
            currentTab={shivaayTab}
            onTabChange={(tab) => {
              setShivaayTab(tab);
              setActiveVideo(null);
            }}
            onReturnToNotebook={handleReturnToNotebook}
          />
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. MODALS & OVERLAYS                                       */}
      {/* ========================================================= */}

      {/* Note Editor Modal */}
      <NoteEditorModal
        note={editingNote}
        isOpen={isNoteEditorOpen}
        onClose={() => {
          setIsNoteEditorOpen(false);
          setEditingNote(null);
        }}
        onSave={handleSaveNote}
        onDelete={editingNote ? (id) => handleDeleteNote(id) : undefined}
      />

      {/* Secret Shivaay Unlocking Ceremony Modal */}
      <SecretUnlockModal
        isOpen={isSecretModalOpen}
        onProceed={handleProceedToShivaay}
      />

      {/* Admin Dashboard Overlay */}
      {isAdminOpen && (
        <AdminDashboard
          onClose={() => setIsAdminOpen(false)}
          categories={categories}
          onRefreshData={loadAllData}
        />
      )}
    </div>
  );
}
