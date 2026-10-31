import {
  Archive,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  AudioLines,
  BookOpen,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Feather,
  FileImage,
  Flame,
  FolderHeart,
  Heart,
  ImagePlus,
  LoaderCircle,
  Menu,
  MessageCircle,
  Mic,
  Plus,
  Search,
  Send,
  Settings2,
  Shield,
  Sparkles,
  Stars,
  Sun,
  Trash2,
  WandSparkles,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import {
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { api } from "./api";
import type { AIResult, AIStatus, Memory, MemoryInput, View } from "./types";

const categories = ["Family", "Friends", "Travel", "Milestone", "Everyday", "Uncategorized"];
const navItems: { id: View; label: string; icon: typeof Archive }[] = [
  { id: "archive", label: "The archive", icon: Archive },
  { id: "timeline", label: "Timeline", icon: Clock3 },
  { id: "companion", label: "Memory companion", icon: MessageCircle },
  { id: "about", label: "Open innovation", icon: Shield },
];

function formatDate(value: string, options?: Intl.DateTimeFormatOptions): string {
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString(
    "en-US",
    options ?? { month: "long", day: "numeric", year: "numeric" },
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

function App() {
  const [view, setView] = useState<View>("home");
  const [memories, setMemories] = useState<Memory[]>([]);
  const [archiveRecords, setArchiveRecords] = useState<Memory[]>([]);
  const [collections, setCollections] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [collectionFilter, setCollectionFilter] = useState("");
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [editingMemory, setEditingMemory] = useState<Memory | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [aiStatus, setAiStatus] = useState<AIStatus | null>(null);
  const [model, setModel] = useState("");
  const [savingModel, setSavingModel] = useState(false);

  const refreshMemories = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [records, savedCollections] = await Promise.all([api.memories(), api.collections()]);
      setMemories(records);
      setCollections(savedCollections);
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshAI = useCallback(async () => {
    try {
      const [status, settings] = await Promise.all([api.aiStatus(), api.settings()]);
      setAiStatus(status);
      setModel(settings.model);
    } catch {
      setAiStatus(null);
    }
  }, []);

  useEffect(() => {
    void refreshMemories();
    void refreshAI();
  }, [refreshAI, refreshMemories]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 3400);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (view !== "archive") return;
    let active = true;
    setLoading(true);
    setError("");
    void api.memories({
      q: query,
      category: categoryFilter,
      collection: collectionFilter,
      sort: "recent",
    })
      .then((records) => {
        if (active) setArchiveRecords(records);
      })
      .catch((caught: unknown) => {
        if (active) setError(getErrorMessage(caught));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [view, query, categoryFilter, collectionFilter]);

  const openStudio = (memory: Memory | null = null) => {
    setEditingMemory(memory);
    setSelectedMemory(null);
    setView("studio");
    setMenuOpen(false);
  };

  const navigate = (nextView: View) => {
    setView(nextView);
    setEditingMemory(null);
    setSelectedMemory(null);
    setMenuOpen(false);
    if (nextView === "archive" || nextView === "home") void refreshMemories();
    if (nextView === "companion") void refreshAI();
  };

  const handleSaved = async (message: string) => {
    setToast(message);
    setEditingMemory(null);
    await refreshMemories();
    setView("archive");
  };

  const removeMemory = async (memory: Memory) => {
    if (!window.confirm(`Permanently remove “${memory.title}” from your archive?`)) return;
    try {
      await api.deleteMemory(memory.id);
      setSelectedMemory(null);
      setToast("Memory removed from the archive.");
      await refreshMemories();
    } catch (caught) {
      setToast(getErrorMessage(caught));
    }
  };

  const saveModel = async () => {
    if (!model.trim()) return;
    setSavingModel(true);
    try {
      const response = await api.setModel(model.trim());
      setModel(response.model);
      await refreshAI();
      setToast("Your local model preference was saved.");
    } catch (caught) {
      setToast(getErrorMessage(caught));
    } finally {
      setSavingModel(false);
    }
  };

  return (
    <div className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <AnimatePresence mode="wait">
        {view === "home" ? (
          <LandingPage key="landing" navigate={navigate} memories={memories} />
        ) : (
          <motion.div
            key="workspace"
            className="workspace"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
          >
            <header className="topbar">
              <button className="brand-lockup" onClick={() => navigate("home")} aria-label="Return home">
                <span className="brand-mark"><Flame size={18} /></span>
                <span>echoes <i>beyond</i></span>
              </button>
              <button
                className="mobile-menu icon-button"
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label={menuOpen ? "Close navigation" : "Open navigation"}
              >
                {menuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
              <nav className={`top-nav ${menuOpen ? "is-open" : ""}`} aria-label="Main navigation">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      className={`nav-link ${view === item.id ? "active" : ""}`}
                      onClick={() => navigate(item.id)}
                    >
                      <Icon size={15} strokeWidth={1.7} /> {item.label}
                    </button>
                  );
                })}
                <button className="nav-cta" onClick={() => openStudio()}>
                  <Plus size={16} /> Add a memory
                </button>
              </nav>
            </header>

            {error && (
              <div className="page-alert" role="alert">
                <CircleHelp size={17} /> <span>{error}</span>
                <button className="text-button" onClick={() => void refreshMemories()}>Try again</button>
              </div>
            )}

            <main className="page-content">
              <AnimatePresence mode="wait">
                {view === "archive" && (
                  <motion.div key="archive" {...pageMotion}>
                    <ArchivePage
                      memories={archiveRecords}
                      allCount={memories.length}
                      collections={collections}
                      loading={loading}
                      query={query}
                      onQuery={setQuery}
                      category={categoryFilter}
                      onCategory={setCategoryFilter}
                      collection={collectionFilter}
                      onCollection={setCollectionFilter}
                      onCreate={() => openStudio()}
                      onOpen={setSelectedMemory}
                      onCreateCollection={async (name) => {
                        try {
                          const updated = await api.createCollection(name);
                          setCollections(updated);
                          setToast(`“${name}” collection created.`);
                        } catch (caught) {
                          setToast(getErrorMessage(caught));
                        }
                      }}
                    />
                  </motion.div>
                )}
                {view === "studio" && (
                  <motion.div key="studio" {...pageMotion}>
                    <StudioPage
                      key={editingMemory?.id ?? "new"}
                      memory={editingMemory}
                      collections={collections}
                      onBack={() => navigate("archive")}
                      onSaved={handleSaved}
                      onToast={setToast}
                    />
                  </motion.div>
                )}
                {view === "companion" && (
                  <motion.div key="companion" {...pageMotion}>
                    <CompanionPage memories={memories} status={aiStatus} onRefresh={refreshAI} />
                  </motion.div>
                )}
                {view === "timeline" && (
                  <motion.div key="timeline" {...pageMotion}>
                    <TimelinePage memories={memories} onOpen={setSelectedMemory} />
                  </motion.div>
                )}
                {view === "about" && (
                  <motion.div key="about" {...pageMotion}>
                    <AboutPage
                      status={aiStatus}
                      model={model}
                      onModel={setModel}
                      onSaveModel={saveModel}
                      saving={savingModel}
                      onRefresh={refreshAI}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </main>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedMemory && (
          <MemoryDetail
            memory={selectedMemory}
            onClose={() => setSelectedMemory(null)}
            onEdit={() => openStudio(selectedMemory)}
            onDelete={() => void removeMemory(selectedMemory)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {toast && (
          <motion.div
            className="toast"
            role="status"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
          >
            <Sparkles size={16} /> {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const pageMotion = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.25 },
};

function LandingPage({
  navigate,
  memories,
}: {
  navigate: (view: View) => void;
  memories: Memory[];
}) {
  const sampleMemories = memories.slice(0, 3);
  const dust = Array.from({ length: 19 }, (_, index) => ({
    left: `${(index * 47 + 6) % 100}%`,
    top: `${(index * 31 + 8) % 83}%`,
    delay: `${(index % 7) * 0.6}s`,
    size: index % 4 === 0 ? 4 : 2,
  }));
  return (
    <motion.div className="landing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <header className="landing-header">
        <button className="brand-lockup" onClick={() => navigate("home")}>
          <span className="brand-mark"><Flame size={18} /></span>
          <span>echoes <i>beyond</i></span>
        </button>
        <div className="landing-header-actions">
          <button className="subtle-link" onClick={() => navigate("about")}>Our philosophy</button>
          <button className="nav-cta" onClick={() => navigate("archive")}>
            Enter the archive <ArrowRight size={16} />
          </button>
        </div>
      </header>

      <section className="hero">
        <div className="hero-glow" />
        <div className="hero-candle" aria-hidden="true">
          <span className="candle-flame"><span /></span><span className="candle-wick" />
          <span className="candle-body" /><span className="candle-shadow" />
        </div>
        {dust.map((particle, index) => (
          <span
            className="dust-particle"
            key={index}
            style={{ left: particle.left, top: particle.top, animationDelay: particle.delay, width: particle.size, height: particle.size }}
          />
        ))}
        <motion.div
          className="hero-copy"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.15 }}
        >
          <div className="eyebrow"><span className="eyebrow-line" /> A quieter kind of forever</div>
          <h1>Some memories<br />deserve to <em>live forever.</em></h1>
          <p>
            A living archive for the moments that made you. Keep your photographs and
            stories close, and let a thoughtful local AI help you find the words.
          </p>
          <div className="hero-actions">
            <button className="button-primary" onClick={() => navigate("archive")}>
              Enter the archive <ArrowRight size={17} />
            </button>
            <button className="button-ghost" onClick={() => document.getElementById("experience")?.scrollIntoView({ behavior: "smooth" })}>
              Discover the experience <ArrowDown size={16} />
            </button>
          </div>
          <div className="hero-proof"><Shield size={14} /> Your archive stays on your device <span /> No cloud AI required</div>
        </motion.div>

        <motion.div
          className="hero-archive-preview"
          initial={{ opacity: 0, x: 25, rotate: 2 }}
          animate={{ opacity: 1, x: 0, rotate: 0 }}
          transition={{ duration: 0.8, delay: 0.35 }}
        >
          <div className="preview-corner">MEMORY NO. 001</div>
          <div className="preview-art">
            <div className="preview-moon" />
            <div className="preview-hill hill-one" />
            <div className="preview-hill hill-two" />
            <div className="preview-tiny-house">⌂</div>
          </div>
          <div className="preview-caption">
            <span className="small-caps">An ordinary Sunday</span>
            <span>Somewhere, the light stayed a little longer.</span>
          </div>
          <span className="preview-index">01 — 03</span>
        </motion.div>
        <div className="hero-note">A place for your <i>still-here</i> moments.</div>
      </section>

      <section className="intro-strip" id="experience">
        <div className="intro-mark"><Stars size={19} /></div>
        <p>Not a replica. Not a séance.<br /><strong>A home for the stories you choose to keep.</strong></p>
        <button className="text-link" onClick={() => navigate("about")}>Why local AI matters <ArrowRight size={15} /></button>
      </section>

      <section className="landing-features">
        <div className="section-heading">
          <span className="eyebrow">A living archive</span>
          <h2>Every memory has<br /><em>a place to return to.</em></h2>
        </div>
        <div className="feature-grid">
          <Feature icon={<FolderHeart />} title="Gather the fragments" text="Photographs, half-remembered details, the story behind a small thing. All held together in collections of your making." />
          <Feature icon={<WandSparkles />} title="Find the words" text="A local open-weight model can help shape your notes into a story. You stay the author; nothing is written without your say." />
          <Feature icon={<Clock3 />} title="Walk through time" text="See your moments in a living timeline. Search, follow a thread, and rediscover what you might have forgotten." />
        </div>
      </section>

      <section className="landing-archive-teaser">
        <div className="teaser-copy">
          <span className="eyebrow">A glimpse inside</span>
          <h2>The archive is<br /><em>already listening.</em></h2>
          <p>Begin with one memory. A photograph, a sentence, a name you want to remember. The rest can wait.</p>
          <button className="button-primary" onClick={() => navigate("archive")}>Open your archive <ArrowRight size={16} /></button>
        </div>
        <div className="teaser-cards">
          {sampleMemories.length ? sampleMemories.map((memory, index) => (
            <div className={`teaser-card teaser-card-${index + 1}`} key={memory.id}>
              {memory.image_url ? <img src={memory.image_url} alt="" /> : <div className="teaser-placeholder"><Sun size={24} /></div>}
              <span>{memory.category} · {formatDate(memory.memory_date, { month: "short", year: "numeric" })}</span>
              <strong>{memory.title}</strong>
            </div>
          )) : (
            <>
              <div className="teaser-card teaser-card-1"><div className="teaser-placeholder"><Sun size={24} /></div><span>THE FIRST PAGE</span><strong>Begin with a small thing.</strong></div>
              <div className="teaser-card teaser-card-2"><div className="teaser-placeholder soft"><Heart size={22} /></div><span>KEPT WITH CARE</span><strong>Made for what matters.</strong></div>
            </>
          )}
        </div>
      </section>

      <footer className="landing-footer">
        <span className="brand-lockup"><span className="brand-mark"><Flame size={16} /></span> echoes <i>beyond</i></span>
        <span>Made for the memories that make us.</span>
        <button className="text-button" onClick={() => navigate("about")}>Open innovation <ArrowRight size={14} /></button>
      </footer>
    </motion.div>
  );
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <article className="feature-card">
      <div className="feature-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  );
}

function PageIntro({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string;
  title: React.ReactNode;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-intro">
      <div>
        <span className="eyebrow"><span className="eyebrow-line" />{eyebrow}</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

function ArchivePage({
  memories,
  allCount,
  collections,
  loading,
  query,
  onQuery,
  category,
  onCategory,
  collection,
  onCollection,
  onCreate,
  onOpen,
  onCreateCollection,
}: {
  memories: Memory[];
  allCount: number;
  collections: string[];
  loading: boolean;
  query: string;
  onQuery: (value: string) => void;
  category: string;
  onCategory: (value: string) => void;
  collection: string;
  onCollection: (value: string) => void;
  onCreate: () => void;
  onOpen: (memory: Memory) => void;
  onCreateCollection: (name: string) => void;
}) {
  const [showNewCollection, setShowNewCollection] = useState(false);
  const [newCollection, setNewCollection] = useState("");
  const submitCollection = (event: FormEvent) => {
    event.preventDefault();
    if (!newCollection.trim()) return;
    onCreateCollection(newCollection.trim());
    setNewCollection("");
    setShowNewCollection(false);
  };

  return (
    <>
      <PageIntro
        eyebrow="The private archive"
        title={<>A life, in <em>fragments.</em></>}
        subtitle="Every little thing you choose to remember, gathered in one place."
        action={<button className="button-primary" onClick={onCreate}><Plus size={17} /> Preserve a memory</button>}
      />
      <div className="archive-stats">
        <span><strong>{allCount.toString().padStart(2, "0")}</strong> memories kept</span>
        <i />
        <span><strong>{collections.length.toString().padStart(2, "0")}</strong> collections</span>
        <i />
        <span><Shield size={14} /> Stored on this device</span>
      </div>
      <div className="archive-toolbar">
        <label className="search-field">
          <Search size={17} />
          <input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Search a name, a place, a feeling…" />
          {query && <button className="clear-search" onClick={() => onQuery("")} aria-label="Clear search"><X size={15} /></button>}
        </label>
        <label className="select-wrap">
          <span className="visually-hidden">Filter by category</span>
          <select value={category} onChange={(event) => onCategory(event.target.value)}>
            <option value="">All categories</option>
            {categories.map((item) => <option key={item}>{item}</option>)}
          </select><ChevronDown size={14} />
        </label>
        <label className="select-wrap collection-select">
          <span className="visually-hidden">Filter by collection</span>
          <select value={collection} onChange={(event) => onCollection(event.target.value)}>
            <option value="">All collections</option>
            {collections.map((item) => <option key={item}>{item}</option>)}
          </select><ChevronDown size={14} />
        </label>
      </div>
      <div className="archive-section-title">
        <div><h2>{query || category || collection ? "Found in the archive" : "Recently remembered"}</h2><span>{memories.length} {memories.length === 1 ? "memory" : "memories"}</span></div>
        <button className="text-button" onClick={() => setShowNewCollection(!showNewCollection)}><Plus size={15} /> New collection</button>
      </div>
      <AnimatePresence>
        {showNewCollection && (
          <motion.form className="collection-create" onSubmit={submitCollection} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
            <FolderHeart size={17} />
            <input autoFocus value={newCollection} onChange={(event) => setNewCollection(event.target.value)} maxLength={100} placeholder="Give this collection a name…" />
            <button className="button-primary small" type="submit">Create</button>
            <button className="icon-button" type="button" aria-label="Cancel" onClick={() => setShowNewCollection(false)}><X size={17} /></button>
          </motion.form>
        )}
      </AnimatePresence>
      {loading ? (
        <div className="memory-grid">{[1, 2, 3].map((item) => <div className="memory-skeleton" key={item}><div /><span /><b /><i /></div>)}</div>
      ) : memories.length ? (
        <div className="memory-grid">
          {memories.map((memory, index) => (
            <MemoryCard key={memory.id} memory={memory} index={index} onClick={() => onOpen(memory)} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Archive size={24} />}
          title={allCount ? "Nothing found in these pages." : "A quiet page, waiting."}
          text={allCount ? "Try another search or clear a filter. Your memories are still here." : "Start with a photograph, a date, or a few words you don't want to lose."}
          action={!allCount ? <button className="button-primary" onClick={onCreate}><Plus size={16} /> Add the first memory</button> : undefined}
        />
      )}
      <div className="archive-footnote"><Shield size={14} /> Your archive lives here, on this device. No account. No cloud. No rush.</div>
    </>
  );
}

function MemoryCard({ memory, index, onClick }: { memory: Memory; index: number; onClick: () => void }) {
  return (
    <motion.button
      className="memory-card"
      onClick={onClick}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.045, 0.3), duration: 0.32 }}
      whileHover={{ y: -5 }}
      layout
    >
      <div className={`memory-card-image ${!memory.image_url ? "no-image" : ""}`}>
        {memory.image_url ? <img src={memory.image_url} alt="" /> : <div className="memory-art"><span className="art-moon" /><span className="art-arch" /><span className="art-hill" /></div>}
        <span className="memory-category">{memory.category}</span>
        <span className="memory-card-date">{formatDate(memory.memory_date, { month: "short", day: "numeric", year: "numeric" })}</span>
      </div>
      <div className="memory-card-body">
        <span className="memory-collection">{memory.collection}</span>
        <h3>{memory.title}</h3>
        <p>{memory.description}</p>
        <div className="memory-card-meta">
          <span>{memory.people ? <><Heart size={12} /> {memory.people}</> : <><BookOpen size={12} /> A moment preserved</>}</span>
          <ArrowRight size={15} />
        </div>
      </div>
    </motion.button>
  );
}

function EmptyState({ icon, title, text, action }: { icon: React.ReactNode; title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}

function StudioPage({
  memory,
  collections,
  onBack,
  onSaved,
  onToast,
}: {
  memory: Memory | null;
  collections: string[];
  onBack: () => void;
  onSaved: (message: string) => Promise<void>;
  onToast: (message: string) => void;
}) {
  const [form, setForm] = useState<MemoryInput>({
    title: memory?.title ?? "",
    memory_date: memory?.memory_date.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    description: memory?.description ?? "",
    people: memory?.people ?? "",
    category: memory?.category ?? "Family",
    tags: memory?.tags ?? [],
    collection: memory?.collection ?? "Unsorted",
  });
  const [tagEntry, setTagEntry] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [aiTask, setAiTask] = useState("");
  const [aiDraft, setAiDraft] = useState<AIResult | null>(null);
  const [aiDraftTask, setAiDraftTask] = useState("");
  const [listening, setListening] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!photo) {
      setPhotoPreview(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const update = (field: keyof MemoryInput, value: string) => setForm((current) => ({ ...current, [field]: value }));

  const addTag = () => {
    const value = tagEntry.trim().replace(/^#/, "");
    if (!value || form.tags.includes(value) || form.tags.length >= 20) return;
    setForm((current) => ({ ...current, tags: [...current.tags, value] }));
    setTagEntry("");
  };

  const startDictation = () => {
    type Recognition = {
      lang: string;
      interimResults: boolean;
      onresult: ((event: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
      onerror: (() => void) | null;
      onend: (() => void) | null;
      start: () => void;
      stop: () => void;
    };
    const speechWindow = window as Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
    const RecognitionAPI = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!RecognitionAPI) {
      onToast("Voice dictation is not available in this browser. You can still type your memory.");
      return;
    }
    const recognition = new RecognitionAPI();
    recognition.lang = navigator.language || "en-US";
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).map((result) => result[0].transcript).join(" ");
      setForm((current) => ({ ...current, description: [current.description, transcript].filter(Boolean).join(" ") }));
    };
    recognition.onerror = () => {
      setListening(false);
      onToast("Voice dictation stopped. Please try again or type your memory.");
    };
    recognition.onend = () => setListening(false);
    setListening(true);
    recognition.start();
  };

  const generate = async (task: string) => {
    const source = form.description.trim();
    if (!source) {
      onToast("Add a few notes first, so the model has something real to work from.");
      return;
    }
    setAiTask(task);
    setAiDraft(null);
    try {
      const result = await api.generate(task, source);
      setAiDraft(result);
      setAiDraftTask(task);
    } catch (caught) {
      onToast(getErrorMessage(caught));
    } finally {
      setAiTask("");
    }
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.title.trim() || !form.description.trim()) {
      onToast("Please add a title and a few words about this memory.");
      return;
    }
    setSaving(true);
    try {
      const saved = memory
        ? await api.updateMemory(memory.id, form)
        : await api.createMemory(form);
      if (photo) {
        try {
          await api.uploadImage(saved.id, photo);
        } catch (caught) {
          await onSaved(
            `${memory ? "Your memory was updated" : "Your memory was saved"}, but the photograph could not be uploaded: ${getErrorMessage(caught)}`,
          );
          return;
        }
      }
      await onSaved(memory ? "Your memory was updated." : "A new memory was lovingly preserved.");
    } catch (caught) {
      onToast(getErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button className="back-link" onClick={onBack}><ArrowLeft size={15} /> Back to the archive</button>
      <PageIntro
        eyebrow="The memory studio"
        title={<>{memory ? "Return to a " : "Keep a "}<em>moment.</em></>}
        subtitle="Write what you remember. It doesn't have to be perfect to be worth keeping."
      />
      <form className="studio-layout" onSubmit={save}>
        <div className="studio-form-column">
          <div className="form-panel">
            <div className="panel-heading"><span className="panel-number">01</span><div><h2>The moment</h2><p>Begin wherever it feels natural.</p></div></div>
            <label className="form-label">A name for this memory <span>REQUIRED</span>
              <input value={form.title} maxLength={160} onChange={(event) => update("title", event.target.value)} placeholder="The day the rain came early…" required />
            </label>
            <div className="form-row">
              <label className="form-label">When did it happen?
                <input type="date" value={form.memory_date} onChange={(event) => update("memory_date", event.target.value)} required />
              </label>
              <label className="form-label">Its place in your life
                <span className="select-input"><select value={form.category} onChange={(event) => update("category", event.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={14} /></span>
              </label>
            </div>
            <label className="form-label">What do you remember? <span>REQUIRED</span>
              <textarea rows={7} maxLength={20000} value={form.description} onChange={(event) => update("description", event.target.value)} placeholder="Start with the details that stayed with you. The smell of rain on the pavement. Who was there. What you almost forgot." required />
              <span className="input-footer"><span>{form.description.length.toLocaleString()} / 20,000</span><button type="button" title="Uses your browser's speech-recognition service; audio may leave this device." className={`dictation-button ${listening ? "listening" : ""}`} onClick={startDictation}>{listening ? <AudioLines size={14} /> : <Mic size={14} />}{listening ? "Listening…" : "Dictate"}</button></span>
              <span className="voice-privacy-note">Dictation uses your browser's speech service and may send audio to its provider. Type for fully local input.</span>
            </label>
            <label className="form-label">People who were there
              <input maxLength={500} value={form.people} onChange={(event) => update("people", event.target.value)} placeholder="Names, nicknames, the ones you remember…" />
            </label>
          </div>

          <div className="form-panel">
            <div className="panel-heading"><span className="panel-number">02</span><div><h2>Keep it together</h2><p>Give this moment a home in your archive.</p></div></div>
            <label className="form-label">Collection
              <span className="select-input">
                <select value={form.collection} onChange={(event) => update("collection", event.target.value)}>
                  {[...new Set(["Unsorted", ...collections, form.collection])].map((item) => <option key={item}>{item}</option>)}
                </select><ChevronDown size={14} />
              </span>
            </label>
            <div className="form-label">Small threads to find it by
              <div className="tag-entry"><span className="tag-hash">#</span><input value={tagEntry} maxLength={40} onChange={(event) => setTagEntry(event.target.value)} onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => { if (event.key === "Enter") { event.preventDefault(); addTag(); } }} placeholder="Add a tag and press Enter" /><button type="button" onClick={addTag} aria-label="Add tag"><Plus size={17} /></button></div>
              <div className="tag-list">{form.tags.map((tag) => <button type="button" className="tag-chip removable" key={tag} onClick={() => setForm((current) => ({ ...current, tags: current.tags.filter((item) => item !== tag) }))}>#{tag}<X size={12} /></button>)}</div>
            </div>
            <div className="form-label">A photograph, if you have one
              <button type="button" className={`photo-drop ${photoPreview || memory?.image_url ? "has-photo" : ""}`} onClick={() => fileInput.current?.click()}>
                {photoPreview ? <img src={photoPreview} alt="Selected memory preview" /> : memory?.image_url && !photo ? <img src={memory.image_url} alt="Current memory" /> : <><ImagePlus size={22} /><span>Choose a photograph</span><small>JPG, PNG, or WebP · up to 8 MB</small></>}
                {(photoPreview || memory?.image_url) && <span className="photo-change"><ImagePlus size={15} /> Change photograph</span>}
              </button>
              <input ref={fileInput} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event: ChangeEvent<HTMLInputElement>) => setPhoto(event.target.files?.[0] ?? null)} />
            </div>
          </div>
        </div>

        <aside className="studio-aside">
          <div className="ai-studio-card">
            <div className="ai-card-title"><span><Sparkles size={17} /></span><div><strong>A little help with the words</strong><small>Local AI · always your choice</small></div></div>
            <p>Use your notes as they are, or invite the local model to help shape them. It must stay true to what you wrote.</p>
            <div className="ai-action-list">
              <button type="button" disabled={!!aiTask} onClick={() => void generate("story")}><WandSparkles size={15} /><span>Shape into a story</span>{aiTask === "story" ? <LoaderCircle className="spin" size={15} /> : <ArrowRight size={14} />}</button>
              <button type="button" disabled={!!aiTask} onClick={() => void generate("title")}><Feather size={15} /><span>Suggest a title</span>{aiTask === "title" ? <LoaderCircle className="spin" size={15} /> : <ArrowRight size={14} />}</button>
              <button type="button" disabled={!!aiTask} onClick={() => void generate("caption")}><FileImage size={15} /><span>Write a caption</span>{aiTask === "caption" ? <LoaderCircle className="spin" size={15} /> : <ArrowRight size={14} />}</button>
              <button type="button" disabled={!!aiTask} onClick={() => void generate("themes")}><Stars size={15} /><span>Notice the themes</span>{aiTask === "themes" ? <LoaderCircle className="spin" size={15} /> : <ArrowRight size={14} />}</button>
              <button type="button" disabled={!!aiTask} onClick={() => void generate("poem")}><Sparkles size={15} /><span>Write a remembrance</span>{aiTask === "poem" ? <LoaderCircle className="spin" size={15} /> : <ArrowRight size={14} />}</button>
            </div>
            {aiTask && <div className="ai-working"><span className="working-orb" /> Your local model is finding the words…</div>}
            {aiDraft && (
              <motion.div className="ai-draft" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <div className="ai-draft-label"><span><Sparkles size={12} /> AI-GENERATED PREVIEW</span><button type="button" aria-label="Dismiss generated preview" onClick={() => setAiDraft(null)}><X size={14} /></button></div>
                <p>{aiDraft.text}</p>
                <small>Model: {aiDraft.model} · Check every detail before keeping this.</small>
                <button type="button" className="button-outline small" onClick={() => {
                  if (aiDraftTask === "title") setForm((current) => ({ ...current, title: aiDraft.text.split("\n")[0].replace(/^\d+[.)]\s*/, "").replace(/^["“]|["”]$/g, "").slice(0, 160) }));
                  else setForm((current) => ({ ...current, description: aiDraft.text }));
                  setAiDraft(null);
                }}><Check size={14} /> Use this draft</button>
              </motion.div>
            )}
            <div className="ai-privacy"><Shield size={13} /> Notes go only to your local Ollama model.</div>
          </div>
          <div className="studio-note"><span className="note-icon"><Sun size={16} /></span><p>You can always come back and change these words. Nothing here has to be the final version.</p></div>
          <button className="button-primary save-memory" type="submit" disabled={saving}>
            {saving ? <><LoaderCircle className="spin" size={16} /> Preserving…</> : <><Check size={16} /> {memory ? "Save these changes" : "Preserve this memory"}</>}
          </button>
          <button className="button-ghost full-width" type="button" onClick={onBack}>Leave without saving</button>
          <div className="save-private"><Shield size={13} /> Private by design, saved on this device</div>
        </aside>
      </form>
    </>
  );
}

function MemoryDetail({
  memory,
  onClose,
  onEdit,
  onDelete,
}: {
  memory: Memory;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <motion.div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.article className="memory-detail-modal" role="dialog" aria-modal="true" aria-labelledby="detail-title" initial={{ opacity: 0, y: 20, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }} transition={{ duration: 0.24 }}>
        <button className="modal-close icon-button" onClick={onClose} aria-label="Close memory"><X size={19} /></button>
        {memory.image_url ? <img className="detail-image" src={memory.image_url} alt="" /> : <div className="detail-art"><span className="art-moon" /><span className="art-hill" /></div>}
        <div className="detail-content">
          <span className="eyebrow">{memory.category} <i>·</i> {memory.collection}</span>
          <h2 id="detail-title">{memory.title}</h2>
          <div className="detail-date"><Clock3 size={14} /> {formatDate(memory.memory_date)} {memory.people && <> <span>·</span> <Heart size={13} /> {memory.people}</>}</div>
          <p className="detail-description">{memory.description}</p>
          {!!memory.tags.length && <div className="tag-list detail-tags">{memory.tags.map((tag) => <span className="tag-chip" key={tag}>#{tag}</span>)}</div>}
          <div className="detail-actions">
            <button className="button-primary" onClick={onEdit}><Feather size={15} /> Edit this memory</button>
            <button className="delete-button" onClick={onDelete}><Trash2 size={15} /> Remove from archive</button>
          </div>
          <div className="detail-private"><Shield size={13} /> Kept privately on this device</div>
        </div>
      </motion.article>
    </motion.div>
  );
}

function CompanionPage({ memories, status, onRefresh }: { memories: Memory[]; status: AIStatus | null; onRefresh: () => Promise<void> }) {
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; text: string; sources: number[]; generated: boolean; model?: string }[]>([
    { role: "assistant", text: "I'm a quiet companion to the memories you've saved here. Ask me about a person, a place, or a moment, and I'll look through your archive. I only know what you've chosen to keep.", sources: [], generated: false },
  ]);
  const [question, setQuestion] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const quickQuestions = ["What do I remember about my family?", "Find moments that mention a garden.", "What stories have I saved from summer?"];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const send = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || sending) return;
    setQuestion("");
    setMessages((items) => [...items, { role: "user", text: trimmed, sources: [], generated: false }]);
    setSending(true);
    try {
      const result = await api.generate("chat", trimmed, trimmed);
      setMessages((items) => [...items, { role: "assistant", ...result }]);
    } catch (caught) {
      setMessages((items) => [...items, {
        role: "assistant",
        text: `${getErrorMessage(caught)} Your saved memories remain safe; check that Ollama is running and try again.`,
        sources: [],
        generated: false,
      }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <PageIntro
        eyebrow="A thoughtful listener"
        title={<>Your memories, in <em>conversation.</em></>}
        subtitle="Ask about what you've saved. The companion can only answer from the archive in front of it."
        action={<span className={`ai-status-pill ${status?.available && status.model_installed ? "online" : "offline"}`}><span />{status?.available ? status.model_installed ? `Ollama · ${status.model}` : `Model not installed · ${status.model}` : "Local model offline"}</span>}
      />
      <div className="companion-notice"><Shield size={15} /><span>This is an AI reading your saved notes, not a person or a presence. It cannot reach beyond the memories you chose to keep.</span><button className="text-button" onClick={onRefresh}>Check model</button></div>
      <div className="companion-layout">
        <section className="chat-panel">
          <div className="chat-heading"><span className="companion-orb"><Sparkles size={18} /></span><div><strong>The memory companion</strong><small>{memories.length} {memories.length === 1 ? "memory" : "memories"} in view · Responses are AI-generated</small></div><span className="chat-local"><span /> LOCAL</span></div>
          <div className="chat-messages">
            {messages.map((message, index) => (
              <motion.div className={`chat-message ${message.role}`} key={index} initial={{ opacity: 0, y: 9 }} animate={{ opacity: 1, y: 0 }}>
                {message.role === "assistant" && <span className="assistant-avatar"><Sparkles size={13} /></span>}
                <div className="message-bubble">
                  {message.role === "assistant" && <span className="message-label">{message.generated ? "AI-GENERATED · " + (message.model ?? "LOCAL MODEL") : "ARCHIVE COMPANION"}</span>}
                  <p>{message.text}</p>
                  {!!message.sources.length && <div className="source-chips"><span>Found in:</span>{message.sources.map((id) => <span className="source-chip" key={id}>Memory #{id}</span>)}</div>}
                </div>
              </motion.div>
            ))}
            {sending && <div className="chat-message assistant"><span className="assistant-avatar"><Sparkles size={13} /></span><div className="message-bubble thinking"><span className="thinking-dots"><i /><i /><i /></span><small>Looking through your archive…</small></div></div>}
            <div ref={endRef} />
          </div>
          <div className="quick-prompts">
            {quickQuestions.map((prompt) => <button key={prompt} onClick={() => void send(prompt)} disabled={sending}>{prompt}<ArrowRight size={12} /></button>)}
          </div>
          <form className="chat-input" onSubmit={(event) => { event.preventDefault(); void send(question); }}>
            <input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask a question about your saved memories…" maxLength={2000} disabled={sending} />
            <button type="submit" disabled={!question.trim() || sending} aria-label="Send question">{sending ? <LoaderCircle className="spin" size={17} /> : <Send size={17} />}</button>
          </form>
          {!status?.available && <div className="chat-offline"><CircleHelp size={14} /> The local AI is offline. Start Ollama to ask questions; your archive is still available.</div>}
        </section>
        <aside className="companion-aside">
          <div className="aside-note"><span className="aside-note-icon"><Shield size={17} /></span><h3>It only knows what you saved.</h3><p>We search your archive first, then share only matching notes with the local model. No match? The companion says so rather than making something up.</p></div>
          <div className="aside-note aside-note-soft"><span className="aside-note-icon"><Heart size={17} /></span><h3>Never a voice from beyond.</h3><p>This is a language model reflecting the words you've saved—not a person, a presence, or a way to contact anyone.</p></div>
          <div className="companion-memory-count"><BookOpen size={15} /><span><strong>{memories.length}</strong> memories ready to rediscover</span></div>
        </aside>
      </div>
    </>
  );
}

function TimelinePage({ memories, onOpen }: { memories: Memory[]; onOpen: (memory: Memory) => void }) {
  const [timelineRecords, setTimelineRecords] = useState<Memory[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(true);
  const [timelineError, setTimelineError] = useState("");
  const availableYears = useMemo(() => [...new Set(memories.map((item) => item.memory_date.slice(0, 4)))].sort().reverse(), [memories]);
  const [year, setYear] = useState("");
  const [category, setCategory] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    setTimelineLoading(true);
    setTimelineError("");
    void api.timeline({ year, category })
      .then((records) => {
        if (active) setTimelineRecords(records);
      })
      .catch((caught: unknown) => {
        if (active) setTimelineError(getErrorMessage(caught));
      })
      .finally(() => {
        if (active) setTimelineLoading(false);
      });
    return () => {
      active = false;
    };
  }, [year, category]);
  const filtered = timelineRecords;
  const byYear = useMemo(() => {
    const grouped: Record<string, Memory[]> = {};
    for (const memory of filtered) (grouped[memory.memory_date.slice(0, 4)] ??= []).push(memory);
    return grouped;
  }, [filtered]);

  return (
    <>
      <PageIntro
        eyebrow="The long way around"
        title={<>A life, unfolding <em>in time.</em></>}
        subtitle="Follow the thread. See what the years have been quietly holding."
        action={<div className="timeline-count"><Clock3 size={15} /> {filtered.length} {filtered.length === 1 ? "moment" : "moments"} remembered</div>}
      />
      <div className="timeline-toolbar">
        <span>WALK THE YEARS</span>
        <div className="filter-pills">
          <button className={!year ? "selected" : ""} onClick={() => setYear("")}>Every year</button>
          {availableYears.map((item) => <button className={year === item ? "selected" : ""} key={item} onClick={() => setYear(item)}>{item}</button>)}
        </div>
        <label className="select-wrap timeline-category"><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">Every kind</option>{categories.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={14} /></label>
      </div>
      {timelineError ? (
        <div className="page-alert" role="alert"><CircleHelp size={17} />{timelineError}</div>
      ) : timelineLoading ? (
        <div className="timeline-loading"><LoaderCircle className="spin" size={18} /> Returning to the memories…</div>
      ) : filtered.length ? (
        <div className="timeline">
          {Object.entries(byYear).sort(([a], [b]) => Number(a) - Number(b)).map(([groupYear, entries]) => (
            <section className="timeline-year" key={groupYear}>
              <div className="year-marker"><span>{groupYear}</span></div>
              <div className="timeline-items">
                {entries.map((memory, index) => {
                  const isExpanded = expanded === memory.id;
                  return (
                    <motion.article className={`timeline-item ${isExpanded ? "expanded" : ""}`} key={memory.id} initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(index * 0.05, 0.25) }}>
                      <span className="timeline-dot" />
                      <button className="timeline-item-button" onClick={() => setExpanded(isExpanded ? null : memory.id)}>
                        <span className="timeline-date">{formatDate(memory.memory_date, { month: "long", day: "numeric" })}<i>·</i>{memory.category}</span>
                        <strong>{memory.title}</strong>
                        <span className="timeline-excerpt">{isExpanded ? memory.description : memory.description.slice(0, 145) + (memory.description.length > 145 ? "…" : "")}</span>
                        <ChevronDown className={isExpanded ? "rotated" : ""} size={16} />
                      </button>
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div className="timeline-expanded" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                            {memory.image_url && <img src={memory.image_url} alt="" />}
                            <span className="timeline-expanded-people">{memory.people ? `Remembered with ${memory.people}` : memory.collection}</span>
                            <button className="text-button" onClick={() => onOpen(memory)}>Open the full memory <ArrowRight size={14} /></button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState icon={<Clock3 size={24} />} title="Time is waiting here." text="As you add memories, they'll gather in this timeline. Every beginning becomes part of a longer story." />
      )}
      <div className="timeline-end"><span className="timeline-end-dot"><Flame size={14} /></span><p>The story is still being written.</p></div>
    </>
  );
}

function AboutPage({
  status,
  model,
  onModel,
  onSaveModel,
  saving,
  onRefresh,
}: {
  status: AIStatus | null;
  model: string;
  onModel: (value: string) => void;
  onSaveModel: () => void;
  saving: boolean;
  onRefresh: () => Promise<void>;
}) {
  return (
    <>
      <PageIntro
        eyebrow="A more open kind of intelligence"
        title={<>Your memories stay <em>yours.</em></>}
        subtitle="The machine can help find the words. It doesn't get to keep them."
      />
      <section className="manifesto-panel">
        <div className="manifesto-ornament"><Flame size={24} /></div>
        <p>Some things are too personal to become someone else's training data.</p>
        <span>That's why Echoes Beyond is built to work with open-weight AI, running on your own machine.</span>
      </section>
      <div className="principle-grid">
        <Principle icon={<Shield />} number="01" title="Private by default" text="Your stories and photographs live in a local SQLite database and a folder on your device. No cloud account. No upload pipeline." />
        <Principle icon={<AudioLines />} number="02" title="Inference, nearby" text="When you ask for help with words, your notes go to Ollama on your machine—not a paid, hosted AI API." />
        <Principle icon={<Settings2 />} number="03" title="Choose your model" text="Use Gemma, Qwen, or any compatible model you have installed. Your archive isn't tied to one provider." />
        <Principle icon={<BookOpen />} number="04" title="Built to outlast" text="An open stack of ordinary files and tools means your memories aren't held inside a service that might disappear." />
      </div>
      <section className="architecture-section">
        <div className="architecture-copy"><span className="eyebrow">A simple, local path</span><h2>No secret doors.<br /><em>No distant servers.</em></h2><p>When you invite the model into a memory, the words travel a short path: from this page to the local API, and then to Ollama. Your photos never go to the model.</p></div>
        <div className="architecture-flow">
          <div className="architecture-node"><span className="architecture-icon"><BookOpen size={18} /></span><strong>Your memory</strong><small>Saved on-device</small></div>
          <div className="architecture-connector"><span /></div>
          <div className="architecture-node"><span className="architecture-icon"><Archive size={18} /></span><strong>Echoes Beyond</strong><small>FastAPI · SQLite</small></div>
          <div className="architecture-connector"><span /></div>
          <div className="architecture-node"><span className="architecture-icon"><Sparkles size={18} /></span><strong>Ollama</strong><small>Local inference</small></div>
          <div className="architecture-foot"><Shield size={13} /> Your device only <span>·</span> No paid API <span>·</span> No internet needed after setup</div>
        </div>
      </section>
      <section className="model-settings">
        <div className="model-settings-heading"><div><span className="eyebrow">Your local model</span><h2>A mind of <em>your choosing.</em></h2><p>Choose an Ollama model you've already downloaded. Switching models never changes your archive.</p></div><button className="button-ghost" onClick={() => void onRefresh()}><AudioLines size={15} /> Check connection</button></div>
        <div className="model-settings-form">
          <div className="model-status">
            <span className={`model-status-dot ${status?.available ? "online" : "offline"}`} />
            <div><strong>{status?.available ? "Ollama is running" : "Ollama is not connected"}</strong><small>{status?.available ? status.model_installed ? "Your selected model is ready for local inference." : "The model name is saved, but it isn't installed yet." : "Your archive still works. Start Ollama to use AI features."}</small></div>
          </div>
          <div className="model-select-row">
            <label className="form-label">Model name
              <span className="select-input model-select">
                <select value={model} onChange={(event) => onModel(event.target.value)}>
                  {model && !status?.models.includes(model) && <option value={model}>{model} (configured)</option>}
                  {status?.models.map((item) => <option key={item}>{item}</option>)}
                  {(!status?.models.length || status?.available === false) && !model && <option value="gemma3:4b">gemma3:4b</option>}
                </select><ChevronDown size={14} />
              </span>
            </label>
            <button className="button-primary" onClick={onSaveModel} disabled={saving || !model.trim()}>{saving ? <LoaderCircle className="spin" size={15} /> : <Check size={15} />} Save model</button>
          </div>
          <div className="model-setup-note"><CircleHelp size={14} /><span>Install models yourself with <code>ollama pull gemma3:4b</code> (or another Ollama model). Echoes Beyond never downloads a model for you.</span></div>
        </div>
      </section>
      <div className="open-source-note"><Heart size={15} /><span>Open source means the archive can keep going, even when everything else moves on.</span></div>
    </>
  );
}

function Principle({ icon, number, title, text }: { icon: React.ReactNode; number: string; title: string; text: string }) {
  return <article className="principle-card"><span className="principle-number">{number}</span><div className="principle-icon">{icon}</div><h3>{title}</h3><p>{text}</p></article>;
}

export default App;
