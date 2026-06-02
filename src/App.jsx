import { useEffect, useRef, useState } from "react";
import "./App.css";

const SEARCH_STATE_KEY = "hosSearchState";
const GENRES_ENDPOINT = "https://hos.toews-api.com/api/genres";
const PROGRAMS_ENDPOINT = "https://hos.toews-api.com/api/programs";
const SEARCH_ENDPOINT = "https://hos.toews-api.com/api/search";
const PRESET_MOODS_ENDPOINT = "https://hos.toews-api.com/api/preset-moods";
const PRESET_MOOD_LIMIT = 100;
const PRESET_MOOD_TOP_POOL_SIZE = 20;
const PRESET_MOOD_TOP_SAMPLE_SIZE = 5;
const PRESET_MOOD_REST_SAMPLE_SIZE = 5;
const MOOD_PLACEHOLDER =
  "Describe the atmosphere you're looking for...";

const loadSavedSearchState = () => {
  const savedState = window.sessionStorage.getItem(SEARCH_STATE_KEY);
  if (!savedState) {
    return {};
  }

  try {
    return JSON.parse(savedState);
  } catch {
    window.sessionStorage.removeItem(SEARCH_STATE_KEY);
    return {};
  }
};

const getInitialSearchMode = () =>
  window.location.hash === "#advanced-search" ? "advanced" : "basic";

const getRandomSample = (items, count) => {
  const pool = [...items];

  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  return pool.slice(0, count);
};

const samplePresetMoodPrograms = (programs) => [
  ...getRandomSample(
    programs.slice(0, PRESET_MOOD_TOP_POOL_SIZE),
    PRESET_MOOD_TOP_SAMPLE_SIZE,
  ),
  ...getRandomSample(
    programs.slice(PRESET_MOOD_TOP_POOL_SIZE),
    PRESET_MOOD_REST_SAMPLE_SIZE,
  ),
];

const capitalizeFirstLetter = (value) => {
  if (typeof value !== "string" || value.length === 0) {
    return value;
  }

  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
};

const formatProgramDate = (value) => {
  if (typeof value !== "string") {
    return "";
  }

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return value;
  }

  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
};

const copyTextToClipboard = async (text) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.top = "-9999px";
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand("copy");
  document.body.removeChild(textArea);
};

export default function App() {
  const moodInputRef = useRef(null);
  const [savedState] = useState(loadSavedSearchState);
  const initialResults = Array.isArray(savedState.results) ? savedState.results : [];
  const initialDescription =
    typeof savedState.description === "string"
      ? savedState.description
      : typeof savedState.query === "string"
        ? savedState.query
        : "";
  const initialProgramQuery =
    typeof savedState.programQuery === "string"
      ? savedState.programQuery
      : typeof savedState.programNumber === "string" && savedState.programNumber
        ? savedState.programNumber
        : typeof savedState.programName === "string"
          ? savedState.programName
          : "";

  const [programQuery, setProgramQuery] = useState(initialProgramQuery);
  const [genre, setGenre] = useState(
    typeof savedState.genre === "string" ? savedState.genre : "",
  );
  const [programDescription, setProgramDescription] = useState(
    typeof savedState.programDescription === "string" ? savedState.programDescription : "",
  );
  const [description, setDescription] = useState(initialDescription);
  const [genres, setGenres] = useState([]);
  const [results, setResults] = useState(initialResults);
  const [noResultsMessage, setNoResultsMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSearchPanelOpen, setIsSearchPanelOpen] = useState(initialResults.length === 0);
  const [searchMode, setSearchMode] = useState(getInitialSearchMode);
  const [expandedProgram, setExpandedProgram] = useState(null);
  const [expandedDescriptionProgram, setExpandedDescriptionProgram] = useState(null);
  const [expandedTrackKey, setExpandedTrackKey] = useState(null);
  const [sourceProgram, setSourceProgram] = useState(
    savedState.sourceProgram && typeof savedState.sourceProgram === "object"
      ? savedState.sourceProgram
      : null,
  );
  const [presetMoods, setPresetMoods] = useState([]);
  const [isMoodIdeasOpen, setIsMoodIdeasOpen] = useState(false);
  const [isPresetMoodsLoading, setIsPresetMoodsLoading] = useState(false);
  const [presetMoodsMessage, setPresetMoodsMessage] = useState("");
  const [selectedPresetMood, setSelectedPresetMood] = useState(
    savedState.selectedPresetMood && typeof savedState.selectedPresetMood === "object"
      ? savedState.selectedPresetMood
      : null,
  );
  const [presetMoodProgramPool, setPresetMoodProgramPool] = useState(
    Array.isArray(savedState.presetMoodProgramPool)
      ? savedState.presetMoodProgramPool
      : [],
  );

  useEffect(() => {
    const handleLocationChange = () => {
      setSearchMode(getInitialSearchMode());
    };

    window.addEventListener("hashchange", handleLocationChange);
    window.addEventListener("popstate", handleLocationChange);
    return () => {
      window.removeEventListener("hashchange", handleLocationChange);
      window.removeEventListener("popstate", handleLocationChange);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadGenres = async () => {
      try {
        const res = await fetch(GENRES_ENDPOINT);
        if (!res.ok) {
          throw new Error("Failed to load genres");
        }

        const data = await res.json();
        if (!Array.isArray(data)) {
          return;
        }

        const normalizedGenres = data
          .filter((item) => item && typeof item.genre === "string")
          .map((item) => ({ id: item.id, genre: item.genre.trim() }))
          .filter((item) => item.genre.length > 0);

        if (isMounted) {
          setGenres(normalizedGenres);
        }
      } catch {
        if (isMounted) {
          setGenres([]);
        }
      }
    };

    loadGenres();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isMoodIdeasOpen) {
      return undefined;
    }

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setIsMoodIdeasOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMoodIdeasOpen]);

  useEffect(() => {
    if (!isSearchPanelOpen || programQuery.trim()) {
      return;
    }

    moodInputRef.current?.focus();
  }, [isSearchPanelOpen, programQuery]);

  const isAdvancedSearch = searchMode === "advanced";
  const hasProgramQuery = programQuery.trim().length > 0;
  const hasMoodQuery = description.trim().length > 0;

  const isGenreAllowed = (value) => {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return true;
    }

    return genres.some((item) => item.genre.toLowerCase() === normalized);
  };

  const handleGenreChange = (e) => {
    setGenre(e.target.value);
    setNoResultsMessage("");
  };

  const handleGenreBlur = () => {
    if (!isGenreAllowed(genre)) {
      setGenre("");
      setNoResultsMessage("Please choose a genre from the list.");
    }
  };

  const handleDescriptionChange = (e) => {
    const nextDescription = e.target.value;
    setDescription(nextDescription);

    if (selectedPresetMood && nextDescription.trim()) {
      setSelectedPresetMood(null);
      setPresetMoodProgramPool([]);
    }
  };

  const handleProgramQueryChange = (e) => {
    const nextProgramQuery = e.target.value;
    setProgramQuery(nextProgramQuery);

    if (nextProgramQuery.trim()) {
      setSelectedPresetMood(null);
      setPresetMoodProgramPool([]);
    }
  };

  const handleSearch = async () => {
    const payload = {};
    const trimmedProgramQuery = programQuery.trim();
    const isProgramNumberSearch = /^\d+$/.test(trimmedProgramQuery);
    const trimmedGenre = genre.trim();
    const useSelectedPresetMood =
      selectedPresetMood &&
      !trimmedProgramQuery &&
      !description.trim() &&
      presetMoodProgramPool.length > 0;

    if (trimmedProgramQuery && !isProgramNumberSearch) {
      payload.program_name = trimmedProgramQuery;
    }

    if (isAdvancedSearch && trimmedGenre && !isGenreAllowed(trimmedGenre)) {
      setNoResultsMessage("Please choose a genre from the list.");
      return;
    }

    if (isAdvancedSearch && trimmedGenre) {
      payload.genre = trimmedGenre;
    }

    if (isAdvancedSearch && programDescription.trim()) {
      payload.program_content = programDescription.trim();
    }

    if (description.trim()) {
      payload.text = description.trim();
    }

    setIsLoading(true);
    setNoResultsMessage("");
    setResults([]);
    setSourceProgram(null);
    setExpandedProgram(null);
    setExpandedDescriptionProgram(null);
    setExpandedTrackKey(null);

    try {
      let nextResults = [];
      let nextPresetMoodProgramPool = [];

      if (isProgramNumberSearch) {
        nextResults = await fetchProgramByNumber(trimmedProgramQuery);
      } else if (useSelectedPresetMood) {
        nextPresetMoodProgramPool = presetMoodProgramPool.length > 0
          ? presetMoodProgramPool
          : await fetchPresetMoodPrograms(selectedPresetMood.slug);
        nextResults = samplePresetMoodPrograms(nextPresetMoodProgramPool);
      } else {
        nextResults = await fetchSearchResults(payload);
      }

      nextResults = Array.isArray(nextResults) ? nextResults : [];

      setSelectedPresetMood(useSelectedPresetMood ? selectedPresetMood : null);
      setPresetMoodProgramPool(useSelectedPresetMood ? nextPresetMoodProgramPool : []);
      setResults(nextResults);
      setIsSearchPanelOpen(nextResults.length === 0);
      setNoResultsMessage(nextResults.length === 0 ? "No matching results found." : "");
      sessionStorage.setItem(
        SEARCH_STATE_KEY,
        JSON.stringify({
          query: description,
          programQuery,
          genre,
          programDescription,
          description,
          results: nextResults,
          selectedPresetMood: useSelectedPresetMood ? selectedPresetMood : null,
          presetMoodProgramPool: useSelectedPresetMood ? nextPresetMoodProgramPool : [],
        }),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!isLoading) {
      handleSearch();
    }
  };

  const handleDescriptionKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading) {
        handleSearch();
      }
    }
  };

  const fetchProgramByNumber = async (number) => {
    const res = await fetch(`${PROGRAMS_ENDPOINT}/${encodeURIComponent(number)}`);
    if (!res.ok) {
      return [];
    }

    const data = await res.json();
    return data && typeof data === "object" ? [data] : [];
  };

  const fetchSearchResults = async (payload) => {
    const res = await fetch(SEARCH_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    return Array.isArray(data) ? data : [];
  };

  const fetchPresetMoodPrograms = async (slug) => {
    const res = await fetch(
      `${PRESET_MOODS_ENDPOINT}/${encodeURIComponent(slug)}/programs?limit=${PRESET_MOOD_LIMIT}`,
    );
    if (!res.ok) {
      return [];
    }

    const data = await res.json();
    return Array.isArray(data?.programs) ? data.programs : [];
  };

  const loadPresetMoods = async () => {
    setIsPresetMoodsLoading(true);
    setPresetMoodsMessage("");

    try {
      const res = await fetch(PRESET_MOODS_ENDPOINT);
      if (!res.ok) {
        throw new Error("Failed to load mood ideas");
      }

      const data = await res.json();
      const normalizedMoods = Array.isArray(data)
        ? data.filter(
            (item) =>
              item &&
              typeof item.slug === "string" &&
              typeof item.name === "string" &&
              typeof item.embedding_text === "string",
          )
        : [];

      setPresetMoods(normalizedMoods);
      setPresetMoodsMessage(
        normalizedMoods.length === 0 ? "No mood ideas are available right now." : "",
      );
    } catch {
      setPresetMoods([]);
      setPresetMoodsMessage("Unable to load mood ideas right now.");
    } finally {
      setIsPresetMoodsLoading(false);
    }
  };

  const handleMoodIdeasClick = async () => {
    setIsMoodIdeasOpen(true);

    if (presetMoods.length === 0 && !isPresetMoodsLoading) {
      await loadPresetMoods();
    }
  };

  const handleMoodIdeasClose = () => {
    setIsMoodIdeasOpen(false);
  };

  const handlePresetMoodSelect = async (mood) => {
    setDescription("");
    setSelectedPresetMood(mood);
    setNoResultsMessage("");
    setIsMoodIdeasOpen(false);
    setIsLoading(true);
    setResults([]);
    setSourceProgram(null);
    setExpandedProgram(null);
    setExpandedDescriptionProgram(null);
    setExpandedTrackKey(null);

    try {
      const nextPresetMoodProgramPool = await fetchPresetMoodPrograms(mood.slug);
      const nextResults = samplePresetMoodPrograms(nextPresetMoodProgramPool);

      setPresetMoodProgramPool(nextPresetMoodProgramPool);
      setResults(nextResults);
      setIsSearchPanelOpen(nextResults.length === 0);
      setNoResultsMessage(nextResults.length === 0 ? "No matching results found." : "");
      sessionStorage.setItem(
        SEARCH_STATE_KEY,
        JSON.stringify({
          query: "",
          programQuery,
          genre,
          programDescription,
          description: "",
          results: nextResults,
          selectedPresetMood: mood,
          presetMoodProgramPool: nextPresetMoodProgramPool,
        }),
      );
    } catch {
      setIsSearchPanelOpen(true);
      setNoResultsMessage("Unable to load programs for that mood right now.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePresetMoodCopy = async (mood) => {
    try {
      await copyTextToClipboard(mood.embedding_text);
    } catch {
      // Keep the field population useful even if clipboard access is blocked.
    }

    setDescription(mood.embedding_text);
    setSelectedPresetMood(null);
    setPresetMoodProgramPool([]);
    setNoResultsMessage("");
    setIsMoodIdeasOpen(false);
    window.requestAnimationFrame(() => {
      moodInputRef.current?.focus();
    });
  };

  const handlePresetMoodRefresh = () => {
    if (!selectedPresetMood || isLoading || presetMoodProgramPool.length === 0) {
      return;
    }

    setNoResultsMessage("");
    setSourceProgram(null);
    setExpandedProgram(null);
    setExpandedDescriptionProgram(null);
    setExpandedTrackKey(null);

    const nextResults = samplePresetMoodPrograms(presetMoodProgramPool);

    setResults(nextResults);
    setIsSearchPanelOpen(nextResults.length === 0);
    setNoResultsMessage(nextResults.length === 0 ? "No matching results found." : "");
    sessionStorage.setItem(
      SEARCH_STATE_KEY,
      JSON.stringify({
        query: "",
        programQuery,
        genre,
        programDescription,
        description: "",
        results: nextResults,
        selectedPresetMood,
        presetMoodProgramPool,
      }),
    );
  };

  const toggleExpanded = (programNumber) => {
    setExpandedProgram((current) =>
      current === programNumber ? null : programNumber,
    );
    setExpandedTrackKey(null);
    setExpandedDescriptionProgram(null);
  };

  const toggleProgramDescription = (programNumber) => {
    setExpandedDescriptionProgram((current) =>
      current === programNumber ? null : programNumber,
    );
    setExpandedProgram(null);
    setExpandedTrackKey(null);
  };

  const handleMoreLikeThis = async (program) => {
    setIsLoading(true);
    setNoResultsMessage("");
    setResults([]);
    setSelectedPresetMood(null);
    setPresetMoodProgramPool([]);
    setExpandedProgram(null);
    setExpandedDescriptionProgram(null);
    setExpandedTrackKey(null);

    const src = {
      program_number: program.program_number,
      title: program.title,
      short_description: program.short_description,
    };
    setSourceProgram(src);

    try {
      const res = await fetch(`https://hos.toews-api.com/api/similar/${program.program_number}`);
      if (!res.ok) {
        throw new Error("Failed to load similar programs");
      }

      const data = await res.json();
      const nextResults = Array.isArray(data) ? data : [];
      setResults(nextResults);
      setIsSearchPanelOpen(nextResults.length === 0);
      setNoResultsMessage(nextResults.length === 0 ? "No matching results found." : "");
      sessionStorage.setItem(
        SEARCH_STATE_KEY,
        JSON.stringify({
          query: "",
          programQuery: "",
          genre: "",
          programDescription: "",
          description: "",
          results: nextResults,
          sourceProgram: src,
          selectedPresetMood: null,
          presetMoodProgramPool: [],
        }),
      );
    } catch {
      setSourceProgram(null);
      setIsSearchPanelOpen(true);
      setNoResultsMessage("Unable to load similar programs right now.");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTrackDetails = (programNumber, trackIndex) => {
    const key = `${programNumber}-${trackIndex}`;
    setExpandedTrackKey((current) => (current === key ? null : key));
  };

  const handleResetFields = () => {
    setProgramQuery("");
    setGenre("");
    setProgramDescription("");
    setDescription("");
    setSelectedPresetMood(null);
    setPresetMoodProgramPool([]);
    setNoResultsMessage("");

    sessionStorage.setItem(
      SEARCH_STATE_KEY,
      JSON.stringify({
        query: "",
        programQuery: "",
        genre: "",
        programDescription: "",
        description: "",
        results,
        selectedPresetMood: null,
        presetMoodProgramPool: [],
      }),
    );
  };

  const handleShowCleanSearch = () => {
    setProgramQuery("");
    setGenre("");
    setProgramDescription("");
    setDescription("");
    setResults([]);
    setSelectedPresetMood(null);
    setPresetMoodProgramPool([]);
    setNoResultsMessage("");
    setIsSearchPanelOpen(true);
    setSourceProgram(null);
    setExpandedProgram(null);
    setExpandedDescriptionProgram(null);
    setExpandedTrackKey(null);
    setSearchMode("basic");
    window.history.replaceState(null, "", window.location.pathname);

    sessionStorage.setItem(
      SEARCH_STATE_KEY,
      JSON.stringify({
        query: "",
        programQuery: "",
        genre: "",
        programDescription: "",
        description: "",
        results: [],
        selectedPresetMood: null,
        presetMoodProgramPool: [],
      }),
    );
  };

  return (
    <>
      <div className="app-shell">
        <div
          className={[
            "top-chrome",
            isSearchPanelOpen ? "is-search-open" : "is-search-closed",
          ].filter(Boolean).join(" ")}
        >
        <header className="page-header">
          <button
            type="button"
            className="header-logo-wrap"
            onClick={handleShowCleanSearch}
            aria-label="Open a clean search form"
          >
            <img
              className="header-logo"
              src="/images/hos_emblem.svg"
              alt="Hearts of Space logo"
            />
          </button>
          <div className="header-title-wrap">
            <div className="header-title-kicker">Music From The Hearts Of Space</div>
            <button
              type="button"
              onClick={handleShowCleanSearch}
              className="page-title"
              aria-label="Clear search and return to original state"
            >
              Archive Search
            </button>
          </div>
          <button
            type="button"
            className="header-search-icon"
            onClick={handleShowCleanSearch}
            aria-label="Open a clean search form"
          >
            <svg viewBox="0 0 24 24" fill="none">
              <circle cx="10" cy="10" r="5.5" stroke="currentColor" strokeWidth="1.8" />
              <path d="M14 14L19 19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        {sourceProgram && (
          <div className="similar-context-bar">
            <span className="similar-context-label">Similar to</span>
            <span className="similar-context-title">
              #{sourceProgram.program_number} &mdash; {sourceProgram.title}
            </span>
            {sourceProgram.short_description && (
              <span className="similar-context-desc">{sourceProgram.short_description}</span>
            )}
          </div>
        )}

        <div className="search-body search-body-top">
          <div className="search-sticky">
            <div
              id="search-fields-panel"
              className={[
                "search-panel",
                isAdvancedSearch ? "is-advanced" : "",
                isSearchPanelOpen ? "is-open" : "",
              ].filter(Boolean).join(" ")}
            >
              <form className="search-fields" onSubmit={handleSearchSubmit}>
                <p className="search-fields-instruction">
                  Search the Music From The Hearts Of Space archives by describing a mood
                  or atmosphere. Alternatively, search by Program Number or Program Name.
                </p>

                {!hasProgramQuery && (
                  <>
                    <textarea
                      ref={moodInputRef}
                      rows={2}
                      placeholder={MOOD_PLACEHOLDER}
                      value={description}
                      onChange={handleDescriptionChange}
                      onKeyDown={handleDescriptionKeyDown}
                      className="search-input"
                    />

                    <div className="mood-ideas-link-wrap">
                      <button
                        type="button"
                        className="mood-ideas-link"
                        onClick={handleMoodIdeasClick}
                        disabled={isLoading}
                      >
                        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path d="M12 3l1.5 5.2L19 10l-5.5 1.8L12 17l-1.5-5.2L5 10l5.5-1.8L12 3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                          <path d="M19 15l.7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7L19 15z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                        </svg>
                        Atmosphere Ideas
                      </button>
                    </div>
                  </>
                )}

                {!hasMoodQuery && (
                  <input
                    type="text"
                    placeholder="Program Number or Name"
                    value={programQuery}
                    onChange={handleProgramQueryChange}
                    className="search-text-input search-text-input-full"
                  />
                )}

                {isAdvancedSearch && (
                  <>
                    <input
                      type="text"
                      placeholder="Genre"
                      value={genre}
                      onChange={handleGenreChange}
                      onBlur={handleGenreBlur}
                      list="genre-options"
                      autoComplete="off"
                      className="search-text-input"
                    />
                    <datalist id="genre-options">
                      {genres.map((item, index) => (
                        <option
                          key={`${String(item.id ?? item.genre)}-${index}`}
                          value={item.genre}
                        />
                      ))}
                    </datalist>

                    <input
                      type="text"
                      placeholder="Program Description, Playlist content"
                      value={programDescription}
                      onChange={(e) => setProgramDescription(e.target.value)}
                      className="search-text-input search-text-input-full"
                    />
                  </>
                )}

                <div className="search-panel-actions">
                  <button
                    type="button"
                    onClick={handleResetFields}
                    disabled={isLoading}
                    className="search-reset-button"
                  >
                    Reset
                  </button>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="search-submit-button"
                  >
                    {isLoading ? "Searching..." : "Search Archive"}
                  </button>
                </div>

              </form>
            </div>
          </div>
          </div>
        </div>

        <div className="search-body search-results-shell">
          <div className="search-results">
            {isLoading && (
              <div className="search-loading" role="status" aria-live="polite">
                <span className="search-spinner" aria-hidden="true" />
                <span>Searching the archive...</span>
              </div>
            )}

          {!isLoading && noResultsMessage && (
            <div className="search-empty-state" role="status" aria-live="polite">
              {noResultsMessage}
            </div>
          )}

          {results.length > 0 && (
            <>
              {selectedPresetMood && (
                <div className="preset-results-heading">
                  <div className="preset-results-heading-copy">
                    <h2>{selectedPresetMood.name}</h2>
                    {selectedPresetMood.description && (
                      <p>{selectedPresetMood.description}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    className="preset-results-refresh-button"
                    onClick={handlePresetMoodRefresh}
                    disabled={isLoading || presetMoodProgramPool.length === 0}
                    aria-label={`Shuffle programs for ${selectedPresetMood.name}`}
                    title="Shuffle programs"
                  >
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M16 3h5v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M20.5 10A8.5 8.5 0 1 1 18 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              )}

              <div className="results-list">
              {results.map((r) => {
                const isExpanded = expandedProgram === r.program_number;
                const isDescriptionExpanded =
                  expandedDescriptionProgram === r.program_number;

                return (
                  <article
                    key={r.program_number}
                    className={`result-row${isExpanded ? " is-expanded" : ""}`}
                  >
                    <div
                      className="result-summary"
                      onClick={() => toggleExpanded(r.program_number)}
                    >
                      <div className="result-card-header">
                        <button
                          type="button"
                          className="play-button"
                          title="Play on HOS"
                          aria-label={`Play ${r.title}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(
                              `https://www.hos.com/programs/details/${r.program_number}?utm_campaign=shareaholic&utm_medium=copy_link&utm_source=bookmark`,
                              "_blank",
                              "noopener,noreferrer",
                            );
                          }}
                        >
                          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <polygon points="5,3 19,12 5,21" />
                          </svg>
                        </button>

                        <strong className="result-title">
                          #{r.program_number} - {r.title}
                        </strong>

                        <div className="result-header-actions">
                          <button
                            type="button"
                            className="result-info-button"
                            title="Program details"
                            aria-label={`${isDescriptionExpanded ? "Hide" : "Show"} description for ${r.title}`}
                            aria-expanded={isDescriptionExpanded}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleProgramDescription(r.program_number);
                            }}
                          >
                            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
                              <path d="M12 10.25V16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                              <circle cx="12" cy="7.5" r="1" fill="currentColor" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            className="result-playlist-button"
                            title="Show playlist"
                            aria-label={`${isExpanded ? "Hide" : "Show"} playlist for ${r.title}`}
                            aria-expanded={isExpanded}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpanded(r.program_number);
                            }}
                          >
                            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                              <path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                            </svg>
                          </button>
                        </div>

                        {r.program_date && (
                          <span className="result-date">
                            {formatProgramDate(r.program_date)}
                          </span>
                        )}
                      </div>

                      <div className="result-card-body">
                        <div className="result-description">
                          {capitalizeFirstLetter(r.short_description)}
                        </div>
                        <button
                          type="button"
                          className="result-more-button"
                          aria-label={`Find more programs like ${r.title}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMoreLikeThis(r);
                          }}
                        >
                          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <circle cx="10" cy="10" r="5.5" stroke="currentColor" strokeWidth="1.8" />
                            <path d="M14 14L19 19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                            <path d="M10 7.5v5M7.5 10h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          </svg>
                          <span>More like this</span>
                        </button>
                      </div>

                      <div className="mobile-result-layout">
                        <div className="mobile-result-action-rail">
                          <button
                            type="button"
                            className="play-button"
                            title="Play on HOS"
                            aria-label={`Play ${r.title}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(
                                `https://www.hos.com/programs/details/${r.program_number}?utm_campaign=shareaholic&utm_medium=copy_link&utm_source=bookmark`,
                                "_blank",
                                "noopener,noreferrer",
                              );
                            }}
                          >
                            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                              <polygon points="5,3 19,12 5,21" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            className="result-info-button"
                            title="Program details"
                            aria-label={`${isDescriptionExpanded ? "Hide" : "Show"} description for ${r.title}`}
                            aria-expanded={isDescriptionExpanded}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleProgramDescription(r.program_number);
                            }}
                          >
                            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
                              <path d="M12 10.25V16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                              <circle cx="12" cy="7.5" r="1" fill="currentColor" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            className="result-playlist-button"
                            title="Show playlist"
                            aria-label={`${isExpanded ? "Hide" : "Show"} playlist for ${r.title}`}
                            aria-expanded={isExpanded}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpanded(r.program_number);
                            }}
                          >
                            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                              <path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                            </svg>
                          </button>
                        </div>

                        <div className="mobile-result-content">
                          <div className="result-title-row">
                            <strong className="result-title">
                              #{r.program_number} - {r.title}
                            </strong>
                            {r.program_date && (
                              <span className="result-date">
                                {formatProgramDate(r.program_date)}
                              </span>
                            )}
                          </div>
                          <div className="result-description">
                            {capitalizeFirstLetter(r.short_description)}
                          </div>
                          <button
                            type="button"
                            className="result-more-button"
                            aria-label={`Find more programs like ${r.title}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMoreLikeThis(r);
                            }}
                          >
                            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                              <circle cx="10" cy="10" r="5.5" stroke="currentColor" strokeWidth="1.8" />
                              <path d="M14 14L19 19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                              <path d="M10 7.5v5M7.5 10h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            </svg>
                            <span>More like this</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    <div
                      className={`result-program-description${isDescriptionExpanded ? " is-open" : ""}`}
                      aria-hidden={!isDescriptionExpanded}
                    >
                      <div
                        className="result-program-description-inner"
                        dangerouslySetInnerHTML={{
                          __html: r.description || "No program description available.",
                        }}
                      />
                    </div>

                    <div
                      className={`result-tracks${isExpanded ? " is-open" : ""}`}
                      aria-hidden={!isExpanded}
                    >
                      <div className="result-tracks-inner">
                        <table className="tracks-table">
                          <thead>
                            <tr>
                              <th>#</th>
                              <th>Track</th>
                              <th className="track-col-artist">Artist</th>
                              <th className="track-col-album">Album</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(r.tracks ?? []).flatMap((t, i) => {
                              const key = `${r.program_number}-${i}`;
                              const isTrackExpanded = expandedTrackKey === key;

                              return [
                                <tr
                                  key={`track-${key}`}
                                  className={`track-row${isTrackExpanded ? " is-open" : ""}`}
                                >
                                  <td>{i + 1}</td>
                                  <td>
                                    <button
                                      type="button"
                                      className="track-name-button"
                                      onClick={() => toggleTrackDetails(r.program_number, i)}
                                      aria-expanded={isTrackExpanded}
                                    >
                                      {t.track || "-"}
                                    </button>
                                  </td>
                                  <td className="track-col-artist">{t.artist || "-"}</td>
                                  <td className="track-col-album">{t.album || "-"}</td>
                                </tr>,
                                <tr
                                  key={`meta-${key}`}
                                  className={`track-meta-row${isTrackExpanded ? " is-open" : ""}`}
                                  aria-hidden={!isTrackExpanded}
                                >
                                  <td colSpan={4}>
                                    <div className="track-meta-panel">
                                      <div className="track-meta-item">
                                        <span className="track-meta-label">Artist</span>
                                        <span className="track-meta-value">{t.artist || "-"}</span>
                                      </div>
                                      <div className="track-meta-item">
                                        <span className="track-meta-label">Album</span>
                                        <span className="track-meta-value">{t.album || "-"}</span>
                                      </div>
                                    </div>
                                  </td>
                                </tr>,
                              ];
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </article>
                );
              })}
              </div>
            </>
          )}
          </div>
        </div>
      </div>

      {isMoodIdeasOpen && (
        <div
          className="mood-modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              handleMoodIdeasClose();
            }
          }}
        >
          <section
            className="mood-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mood-modal-title"
          >
            <div className="mood-modal-header">
              <h2 id="mood-modal-title">Atmosphere Ideas</h2>
              <button
                type="button"
                className="mood-modal-close"
                onClick={handleMoodIdeasClose}
                aria-label="Close mood ideas"
              >
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M7 7l10 10M17 7L7 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {isPresetMoodsLoading && (
              <div className="mood-modal-status" role="status">
                Loading mood ideas...
              </div>
            )}

            {!isPresetMoodsLoading && presetMoodsMessage && (
              <div className="mood-modal-status" role="status">
                {presetMoodsMessage}
              </div>
            )}

            {!isPresetMoodsLoading && presetMoods.length > 0 && (
              <div className="mood-list">
                {presetMoods.map((mood) => (
                  <div
                    key={mood.slug}
                    className="mood-card"
                  >
                    <button
                      type="button"
                      className="mood-card-select"
                      onClick={() => handlePresetMoodSelect(mood)}
                      disabled={isLoading}
                    >
                      <span className="mood-card-title">{mood.name}</span>
                      {mood.description && (
                        <span className="mood-card-description">{mood.description}</span>
                      )}
                    </button>
                    <button
                      type="button"
                      className="mood-card-copy"
                      onClick={() => handlePresetMoodCopy(mood)}
                      disabled={isLoading}
                      aria-label={`Copy ${mood.name} mood text`}
                      title="Copy mood text"
                    >
                      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <rect x="8" y="8" width="10" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
                        <path d="M6 16H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
