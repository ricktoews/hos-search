import { useEffect, useState } from "react";
import "./App.css";

const SEARCH_STATE_KEY = "hosSearchState";

const formatDuration = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
};

export default function App() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedProgram, setExpandedProgram] = useState(null);

  useEffect(() => {
    const savedState = sessionStorage.getItem(SEARCH_STATE_KEY);
    if (!savedState) {
      return;
    }

    try {
      const parsedState = JSON.parse(savedState);

      if (typeof parsedState.query === "string") {
        setQuery(parsedState.query);
      }

      if (Array.isArray(parsedState.results)) {
        setResults(parsedState.results);
      }
    } catch {
      sessionStorage.removeItem(SEARCH_STATE_KEY);
    }
  }, []);

  const handleSearch = async () => {
    setIsLoading(true);
    setExpandedProgram(null);

    try {
      const res = await fetch("https://hos.toews-api.com/api/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: query }),
      });

      const data = await res.json();
      setResults(data);
      sessionStorage.setItem(
        SEARCH_STATE_KEY,
        JSON.stringify({
          query,
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
  };

  return (
    <div className="app-shell">
      <header className="page-header">
        <div className="header-logo-wrap">
          <img
            className="header-logo"
            src="https://v4.hos.com/assets/images/hos-logo-white.svg"
            alt="Hearts of Space logo"
          />
          <span className="header-tagline">SLOW MUSIC FOR FAST TIMES</span>
        </div>
        <h1 className="page-title">Archive Search</h1>
      </header>

      <div className="search-body">
        <div className="search-sticky">
        <div className="search-controls">
        <textarea
          rows={2}
          placeholder="Describe a mood..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="search-input"
        />

        <button
          type="button"
          onClick={handleSearch}
          disabled={isLoading}
          className="search-button"
          aria-label="Search"
          title="Search"
        >
          <svg
            className="search-button-icon"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="M20 20L16.65 16.65" stroke="currentColor" strokeWidth="2" />
          </svg>
        </button>
      </div>
        </div>{/* end search-sticky */}

      <div className="search-results">
        {isLoading && (
          <div className="search-loading" role="status" aria-live="polite">
            <span className="search-spinner" aria-hidden="true" />
            <span>Searching the archive...</span>
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
                    <div>
                      <strong className="result-title">
                        #{r.program_number} - {r.title}
                      </strong>
                      <div className="result-description">{r.short_description}</div>
                    </div>
                    <span className="result-toggle">{isExpanded ? "Hide" : "Show"}</span>
                  </button>

                  {isExpanded && (
                    <div className="result-tracks">
                      <table className="tracks-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Track</th>
                            <th>Artist</th>
                            <th>Album</th>
                            <th>Duration</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(r.tracks ?? []).map((t, i) => (
                            <tr key={i}>
                              <td>{i + 1}</td>
                              <td>{t.track}</td>
                              <td>{t.artist}</td>
                              <td>{t.album}</td>
                              <td>{formatDuration(t.duration)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
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