import { useEffect, useState } from "react";
import "./App.css";

const SEARCH_STATE_KEY = "hosSearchState";
const GENRES_ENDPOINT = "https://hos.toews-api.com/api/genres";

export default function App() {
  const [programName, setProgramName] = useState("");
  const [genres, setGenres] = useState([]);
  const [genre, setGenre] = useState("");
  const [programDescription, setProgramDescription] = useState("");
  const [description, setDescription] = useState("");
  const [results, setResults] = useState([]);
  const [noResultsMessage, setNoResultsMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSearchPanelOpen, setIsSearchPanelOpen] = useState(true);
  const [expandedProgram, setExpandedProgram] = useState(null);
  const [expandedDescriptionProgram, setExpandedDescriptionProgram] = useState(null);
  const [expandedTrackKey, setExpandedTrackKey] = useState(null);
  const [sourceProgram, setSourceProgram] = useState(null);

  useEffect(() => {
    const savedState = sessionStorage.getItem(SEARCH_STATE_KEY);
    if (!savedState) {
      return;
    }

    try {
      const parsedState = JSON.parse(savedState);

      if (typeof parsedState.programName === "string") {
        setProgramName(parsedState.programName);
      }

      if (typeof parsedState.genre === "string") {
        setGenre(parsedState.genre);
      }

      if (typeof parsedState.programDescription === "string") {
        setProgramDescription(parsedState.programDescription);
      }

      if (typeof parsedState.description === "string") {
        setDescription(parsedState.description);
      } else if (typeof parsedState.query === "string") {
        // Backward compatibility for previously saved single-text searches.
        setDescription(parsedState.query);
      }

      if (Array.isArray(parsedState.results)) {
        setResults(parsedState.results);
        if (parsedState.results.length > 0) {
          setIsSearchPanelOpen(false);
        }
      }

      if (parsedState.sourceProgram && typeof parsedState.sourceProgram === "object") {
        setSourceProgram(parsedState.sourceProgram);
      }
    } catch {
      sessionStorage.removeItem(SEARCH_STATE_KEY);
    }
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

  const handleSearch = async () => {
    const payload = {};
    const trimmedGenre = genre.trim();

    if (programName.trim()) {
      payload.program_name = programName.trim();
    }

    if (trimmedGenre && !isGenreAllowed(trimmedGenre)) {
      setNoResultsMessage("Please choose a genre from the list.");
      return;
    }

    if (trimmedGenre) {
      payload.genre = trimmedGenre;
    }

    if (programDescription.trim()) {
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
      const res = await fetch("https://hos.toews-api.com/api/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      setResults(data);
      setIsSearchPanelOpen(data.length === 0);
      setNoResultsMessage(data.length === 0 ? "No matching results found." : "");
      sessionStorage.setItem(
        SEARCH_STATE_KEY,
        JSON.stringify({
          query: description,
          programName,
          genre,
          programDescription,
          description,
          results: data,
        }),
      );
    } finally {
      setIsLoading(false);
    }
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
          programName: "",
          genre: "",
          programDescription: "",
          description: "",
          results: nextResults,
          sourceProgram: src,
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
    setProgramName("");
    setGenre("");
    setProgramDescription("");
    setDescription("");
    setNoResultsMessage("");

    sessionStorage.setItem(
      SEARCH_STATE_KEY,
      JSON.stringify({
        query: "",
        programName: "",
        genre: "",
        programDescription: "",
        description: "",
        results,
      }),
    );
  };

  const handleTitleClick = () => {
    setProgramName("");
    setGenre("");
    setProgramDescription("");
    setDescription("");
    setResults([]);
    setNoResultsMessage("");
    setIsSearchPanelOpen(true);
    setSourceProgram(null);
    setExpandedProgram(null);
    setExpandedDescriptionProgram(null);
    setExpandedTrackKey(null);

    sessionStorage.setItem(
      SEARCH_STATE_KEY,
      JSON.stringify({
        query: "",
        programName: "",
        genre: "",
        programDescription: "",
        description: "",
        results: [],
      }),
    );
  };

  const handleSearchToggleClick = () => {
    if (!isSearchPanelOpen) {
      // Opening the panel: reset fields and clear any MLT context
      setProgramName("");
      setGenre("");
      setProgramDescription("");
      setDescription("");
      setSourceProgram(null);
      setResults([]);
      setNoResultsMessage("");
      setExpandedProgram(null);
      setExpandedDescriptionProgram(null);
      setExpandedTrackKey(null);
    }
    setIsSearchPanelOpen((value) => !value);
  };

  return (
    <div className="app-shell">
      <div
        className={[
          "top-chrome",
          isSearchPanelOpen ? "is-search-open" : "is-search-closed",
        ].filter(Boolean).join(" ")}
      >
        <header className="page-header">
          <div className="header-logo-wrap">
            <img
              className="header-logo"
              src="/images/hos_emblem.svg"
              alt="Hearts of Space logo"
            />
          </div>
          <button
            type="button"
            onClick={handleTitleClick}
            className="page-title"
            aria-label="Clear search and return to original state"
          >
            Archive Search
          </button>
          <button
            type="button"
            className="header-search-icon"
            onClick={handleSearchToggleClick}
            aria-label={isSearchPanelOpen ? "Close search form" : "Open search form"}
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
                isSearchPanelOpen ? "is-open" : "",
              ].filter(Boolean).join(" ")}
            >
              <div className="search-fields">
                <input
                  type="text"
                  placeholder="Program Name"
                  value={programName}
                  onChange={(e) => setProgramName(e.target.value)}
                  className="search-text-input"
                />

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

                <textarea
                  rows={2}
                  placeholder="Mood"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="search-input"
                />

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
                    type="button"
                    onClick={handleSearch}
                    disabled={isLoading}
                    className="search-submit-button"
                  >
                    {isLoading ? "Searching..." : "Search Archive"}
                  </button>
                </div>
              </div>
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
                    <button
                      type="button"
                      className="result-summary"
                      onClick={() => toggleExpanded(r.program_number)}
                      aria-expanded={isExpanded}
                    >
                      <div className="result-button-col">
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
                      <div className="result-content">
                        <div className="result-title-row">
                          <strong className="result-title">
                            #{r.program_number} - {r.title}
                          </strong>
                          {r.program_date && (
                            <span className="result-date">
                              {new Date(r.program_date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                            </span>
                          )}
                        </div>
                        <div className="result-description">{r.short_description}</div>
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
                    </button>

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
          )}
        </div>
      </div>
    </div>
  );
}
