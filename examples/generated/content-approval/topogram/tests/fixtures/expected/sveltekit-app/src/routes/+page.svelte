import { Link } from "react-router-dom";

const screens = [
  {
    "id": "article_list",
    "title": "Articles",
    "route": "/articles",
    "navigable": true
  },
  {
    "id": "article_detail",
    "title": "Article Details",
    "route": "/articles/:id",
    "navigable": false
  },
  {
    "id": "article_create",
    "title": "Create Article",
    "route": "/articles/new",
    "navigable": true
  },
  {
    "id": "article_edit",
    "title": "Edit Article",
    "route": "/articles/:id/edit",
    "navigable": false
  },
  {
    "id": "editorial_settings",
    "title": "Editorial Settings",
    "route": "/settings",
    "navigable": true
  }
];
const demoPrimaryId = import.meta.env.PUBLIC_TOPOGRAM_DEMO_PRIMARY_ID || "";

export function HomePage() {
  const demoPrimaryRoute = demoPrimaryId ? `/articles/${demoPrimaryId}` : null;

  return (
    <div className="stack">
      <section className="card hero">
        <div>
          <h1>Content Approval Web UI (SvelteKit)</h1>
          <p>Generated from Topogram via the `sveltekit` profile and wired to the generated API client.</p>
        </div>
        <div className="button-row">
          <Link className="button-link" to="/articles">Articles</Link>
          <Link className="button-link secondary" to="/articles/new">Create Article</Link>
          {demoPrimaryRoute ? <Link className="button-link secondary" to={demoPrimaryRoute}>Open Demo Article</Link> : null}
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
