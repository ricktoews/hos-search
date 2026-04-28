import { useEffect, useState } from "react";
import "./App.css";

const SEARCH_STATE_KEY = "hosSearchState";

export default function App() {
  const [programName, setProgramName] = useState("");
  const [trackTitle, setTrackTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [album, setAlbum] = useState("");
  const [description, setDescription] = useState("");
  const [results, setResults] = useState([]);
  const [noResultsMessage, setNoResultsMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSearchPanelOpen, setIsSearchPanelOpen] = useState(true);
  const [expandedProgram, setExpandedProgram] = useState(null);
  const [expandedTrackKey, setExpandedTrackKey] = useState(null);
  const showSearchToggle = results.length > 0;

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

      if (typeof parsedState.trackTitle === "string") {
        setTrackTitle(parsedState.trackTitle);
      }

      if (typeof parsedState.artist === "string") {
        setArtist(parsedState.artist);
      }

      if (typeof parsedState.album === "string") {
        setAlbum(parsedState.album);
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
    } catch {
      sessionStorage.removeItem(SEARCH_STATE_KEY);
    }
  }, []);

  const handleSearch = async () => {
    const payload = {};

    if (programName.trim()) {
      payload.program_name = programName.trim();
    }

    if (description.trim()) {
      payload.text = description.trim();
    }

    if (trackTitle.trim()) {
      payload.title = trackTitle.trim();
    }

    if (artist.trim()) {
      payload.artist = artist.trim();
    }

    if (album.trim()) {
      payload.album = album.trim();
    }

    setIsLoading(true);
    setNoResultsMessage("");
    setResults([]);
    setExpandedProgram(null);
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
          trackTitle,
          artist,
          album,
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
  };

  const toggleTrackDetails = (programNumber, trackIndex) => {
    const key = `${programNumber}-${trackIndex}`;
    setExpandedTrackKey((current) => (current === key ? null : key));
  };

  const handleResetFields = () => {
    setProgramName("");
    setTrackTitle("");
    setArtist("");
    setAlbum("");
    setDescription("");
    setNoResultsMessage("");

    sessionStorage.setItem(
      SEARCH_STATE_KEY,
      JSON.stringify({
        query: "",
        programName: "",
        trackTitle: "",
        artist: "",
        album: "",
        description: "",
        results,
      }),
    );
  };

  const handleTitleClick = () => {
    setProgramName("");
    setTrackTitle("");
    setArtist("");
    setAlbum("");
    setDescription("");
    setResults([]);
    setNoResultsMessage("");
    setIsSearchPanelOpen(true);
    setExpandedProgram(null);
    setExpandedTrackKey(null);

    sessionStorage.setItem(
      SEARCH_STATE_KEY,
      JSON.stringify({
        query: "",
        programName: "",
        trackTitle: "",
        artist: "",
        album: "",
        description: "",
        results: [],
      }),
    );
  };

  const handleSearchToggleClick = () => {
    if (!isSearchPanelOpen) {
      // Opening the panel: reset fields
      setProgramName("");
      setTrackTitle("");
      setArtist("");
      setAlbum("");
      setDescription("");
    }
    setIsSearchPanelOpen((value) => !value);
  };

  return (
    <div className="app-shell">
      <div
        className={[
          "top-chrome",
          showSearchToggle ? "has-toggle" : "",
          isSearchPanelOpen ? "is-search-open" : "is-search-closed",
        ].filter(Boolean).join(" ")}
      >
        <header className="page-header">
          <div className="header-logo-wrap">
            <img
              className="header-logo"
              src="https://v4.hos.com/assets/images/hos-logo-white.svg"
              alt="Hearts of Space logo"
            />
            <span className="header-tagline">SLOW MUSIC FOR FAST TIMES</span>
          </div>
          <button
            type="button"
            onClick={handleTitleClick}
            className="page-title"
            aria-label="Clear search and return to original state"
          >
            Archive Search
          </button>
        </header>

        {showSearchToggle && (
          <div className="search-toggle-bar">
            <button
              type="button"
              onClick={handleSearchToggleClick}
              className="search-toggle-button"
            >
              {isSearchPanelOpen ? "Close" : "Search"}
            </button>
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
                  placeholder="Track title"
                  value={trackTitle}
                  onChange={(e) => setTrackTitle(e.target.value)}
                  className="search-text-input"
                />

                <input
                  type="text"
                  placeholder="Artist"
                  value={artist}
                  onChange={(e) => setArtist(e.target.value)}
                  className="search-text-input"
                />

                <input
                  type="text"
                  placeholder="Album"
                  value={album}
                  onChange={(e) => setAlbum(e.target.value)}
                  className="search-text-input"
                />

                <textarea
                  rows={2}
                  placeholder="Description"
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
                      <button
                        type="button"
                        className="play-button"
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
                      <div className="result-content">
                        <strong className="result-title">
                          #{r.program_number} - {r.title}
                        </strong>
                        <div className="result-description">{r.short_description}</div>
                      </div>
                      <span className="result-toggle">{isExpanded ? "Hide" : "Show"}</span>
                    </button>

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
                                </tr>,
                                <tr
                                  key={`meta-${key}`}
                                  className={`track-meta-row${isTrackExpanded ? " is-open" : ""}`}
                                  aria-hidden={!isTrackExpanded}
                                >
                                  <td colSpan={2}>
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