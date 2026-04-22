import { Link } from "react-router-dom";

const screens = [
  {
    "id": "issue_list",
    "title": "Issues",
    "route": "/issues",
    "navigable": true
  },
  {
    "id": "issue_detail",
    "title": "Issue Details",
    "route": "/issues/:id",
    "navigable": false
  },
  {
    "id": "issue_create",
    "title": "Create Issue",
    "route": "/issues/new",
    "navigable": true
  },
  {
    "id": "issue_edit",
    "title": "Edit Issue",
    "route": "/issues/:id/edit",
    "navigable": false
  }
];
const demoPrimaryId = import.meta.env.PUBLIC_TOPOGRAM_DEMO_PRIMARY_ID || "";

export function HomePage() {
  const demoPrimaryRoute = demoPrimaryId ? `/issues/${demoPrimaryId}` : null;

  return (
    <div className="stack">
      <section className="card hero">
        <div>
          <h1>Issues Web UI</h1>
          <p>Generated from Topogram via the `react` profile and wired to the generated API client.</p>
        </div>
        <div className="button-row">
          <Link className="button-link" to="/issues">Issues</Link>
          <Link className="button-link secondary" to="/issues/new">Create Issue</Link>
          {demoPrimaryRoute ? <Link className="button-link secondary" to={demoPrimaryRoute}>Open Demo Issue</Link> : null}
        </div>
      </section>

      <section className="grid two">
        {screens.map((screen) => (
          <article className="card" key={screen.id}>
            <h2>{screen.title}</h2>
            {screen.navigable ? (
              <p><Link to={screen.route}>Open screen</Link></p>
            ) : screen.route ? (
              <>
                <p className="muted">This screen uses a dynamic route.</p>
                <small>{screen.route}</small>
              </>
            ) : (
              <p className="muted">No direct route is exposed for this screen.</p>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}
