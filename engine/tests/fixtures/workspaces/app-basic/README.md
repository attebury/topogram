# App-Basic Fixture

`app-basic` is the engine's complex generated-app regression fixture. It uses
Task, Project, and User as neutral sample domain concepts so engine tests can
exercise API, web, database, verification, component, and implementation-provider
behavior without depending on a product demo.

Keep this fixture engine-owned and purpose-built:

- Do not import demo repos or generated demo apps.
- Do not add product-branded package names, service names, env vars, or visible
  labels.
- Do not use this fixture as consumer release proof. Package, template,
  generator, catalog, and demo consumer proof belongs in the repos that users
  install from.
