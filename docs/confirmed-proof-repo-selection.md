# Confirmed Proof Repo Selection

This document fixes the initial brownfield proof corpus up front so stack work can proceed without stopping for repo selection.

## Clone Rule

Use shallow clones by default for proof repos:

- `git clone --depth 1 <repo> <dest>`

Only fall back to a full clone when history, tags, or some repo-specific behavior is actually needed.

## Primary Proof Repos

### .NET Core

- Primary: [`gothinkster/aspnetcore-realworld-example-app`](https://github.com/gothinkster/aspnetcore-realworld-example-app)
- Local clone: [/Users/attebury/Documents/topogram/trials/aspnetcore-realworld-example-app](/Users/attebury/Documents/topogram/trials/aspnetcore-realworld-example-app)

Why:

- real domain and auth flows
- established RealWorld semantics
- strong backend/API proof target for ASP.NET Core

### Java / Spring

- Primary: [`alexey-lapin/realworld-backend-spring`](https://github.com/alexey-lapin/realworld-backend-spring)
- Local clone: [/Users/attebury/Documents/topogram/trials/realworld-backend-spring](/Users/attebury/Documents/topogram/trials/realworld-backend-spring)

Why:

- Spring Boot
- Spring Data JPA
- Liquibase
- OpenAPI/Swagger
- JWT/security and RealWorld semantics

### Java / Quarkus

- Primary: [`diegocamara/realworld-api-quarkus`](https://github.com/diegocamara/realworld-api-quarkus)
- Local clone: [/Users/attebury/Documents/topogram/trials/realworld-api-quarkus](/Users/attebury/Documents/topogram/trials/realworld-api-quarkus)

Why:

- Quarkus
- RealWorld semantics
- JPA/Hibernate-backed domain
- auth and CRUD flows
- strongest first proof for Java beyond Spring

### Java / Micronaut

- Primary: [`alexey-lapin/realworld-backend-micronaut`](https://github.com/alexey-lapin/realworld-backend-micronaut)
- Local clone: [/Users/attebury/Documents/topogram/trials/realworld-backend-micronaut](/Users/attebury/Documents/topogram/trials/realworld-backend-micronaut)

Why:

- Micronaut
- RealWorld semantics
- strong controller/resource + auth pressure
- closest apples-to-apples comparison against the proven Spring RealWorld path

### Java / Jakarta EE

- Primary: [`hantsy/jakartaee-rest-sample`](https://github.com/hantsy/jakartaee-rest-sample)
- Local clone: [/Users/attebury/Documents/topogram/trials/jakartaee-rest-sample](/Users/attebury/Documents/topogram/trials/jakartaee-rest-sample)

Why:

- Jakarta EE / JAX-RS
- CDI-style resources
- modern Jakarta baseline
- useful standards-driven Java proof outside Spring assumptions

### Android

- Primary: [`android/nowinandroid`](https://github.com/android/nowinandroid)
- Local clone: [/Users/attebury/Documents/topogram/trials/nowinandroid](/Users/attebury/Documents/topogram/trials/nowinandroid)

Why:

- modern Jetpack Compose architecture
- strong UI and navigation proof target
- useful pressure on modular Android extraction

### iOS

- Primary: [`nalexn/clean-architecture-swiftui`](https://github.com/nalexn/clean-architecture-swiftui)
- Local clone: [/Users/attebury/Documents/topogram/trials/clean-architecture-swiftui](/Users/attebury/Documents/topogram/trials/clean-architecture-swiftui)

Why:

- SwiftUI
- networking
- persistence
- navigation and architecture boundaries are clear

### MAUI

- Primary: [`EgemenCiftci/maui-mvvm-sample`](https://github.com/EgemenCiftci/maui-mvvm-sample)
- Local clone: [/Users/attebury/Documents/topogram/trials/maui-mvvm-sample](/Users/attebury/Documents/topogram/trials/maui-mvvm-sample)

Why:

- focused MAUI + MVVM proof target
- easier first confirmation than a very large sample corpus

## Backup / Reference Repos

These are cloned now so later proof work does not need another repo-selection pause.

### .NET Core backup

- [`dotnet-architecture/eShopOnWeb`](https://github.com/dotnet-architecture/eShopOnWeb)
- Local clone: [/Users/attebury/Documents/topogram/trials/eShopOnWeb](/Users/attebury/Documents/topogram/trials/eShopOnWeb)

Use when:

- ASP.NET Core extraction needs a second proof target
- we want stronger EF Core / MVC-style pressure after the RealWorld backend proof

### Java / Spring backup

- [`gothinkster/spring-boot-realworld-example-app`](https://github.com/gothinkster/spring-boot-realworld-example-app)
- Local clone: [/Users/attebury/Documents/topogram/trials/spring-boot-realworld-example-app](/Users/attebury/Documents/topogram/trials/spring-boot-realworld-example-app)

Use when:

- we want a second RealWorld-style Spring proof
- we want stronger controller/API pressure even though the persistence layer is MyBatis rather than JPA

### Java clean-architecture backup

- [`eliostvs/clean-architecture-delivery-example`](https://github.com/eliostvs/clean-architecture-delivery-example)
- Local clone: [/Users/attebury/Documents/topogram/trials/clean-architecture-delivery-example](/Users/attebury/Documents/topogram/trials/clean-architecture-delivery-example)

Use when:

- we want a Java proof that stresses clean-architecture layering directly
- we want to validate Spring extraction outside the RealWorld shape

### Java / Quarkus backup

- [`quarkusio/quarkus-super-heroes`](https://github.com/quarkusio/quarkus-super-heroes)
- Local clone: [/Users/attebury/Documents/topogram/trials/quarkus-super-heroes](/Users/attebury/Documents/topogram/trials/quarkus-super-heroes)

Use when:

- we want a second Quarkus confirmation target
- we need a richer Quarkus app with more architecture and operational surface than the first RealWorld proof

### Java / Micronaut backup

- [`asc-lab/micronaut-microservices-poc`](https://github.com/asc-lab/micronaut-microservices-poc)
- Local clone: [/Users/attebury/Documents/topogram/trials/micronaut-microservices-poc](/Users/attebury/Documents/topogram/trials/micronaut-microservices-poc)

Use when:

- we want a second Micronaut confirmation target
- we need a more complex Micronaut corpus with JWT, persistence, and service-to-service patterns

### Java / Jakarta EE backup

- [`OpenLiberty/sample-keycloak`](https://github.com/OpenLiberty/sample-keycloak)
- Local clone: [/Users/attebury/Documents/topogram/trials/openliberty-sample-keycloak](/Users/attebury/Documents/topogram/trials/openliberty-sample-keycloak)

Use when:

- we want a second Jakarta EE confirmation target
- we need stronger auth and JWT pressure on the Jakarta/JAX-RS path

### Android backup

- [`skydoves/pokedex-compose`](https://github.com/skydoves/pokedex-compose)
- Local clone: [/Users/attebury/Documents/topogram/trials/pokedex-compose](/Users/attebury/Documents/topogram/trials/pokedex-compose)

Use when:

- we want a cleaner Room/Retrofit/Compose proof target
- `nowinandroid` is too architecture-heavy for a first Android extractor pass

### MAUI reference corpus

- [`dotnet/maui-samples`](https://github.com/dotnet/maui-samples)
- Local clone: [/Users/attebury/Documents/topogram/trials/maui-samples](/Users/attebury/Documents/topogram/trials/maui-samples)

Use when:

- we need broader MAUI pattern coverage
- we want follow-up proof targets after the focused MVVM sample

## Usage Rule

Start with the primary repo for each family.

Only move to the backup/reference repo when:

- the primary repo exposes a blocker unrelated to the target extractor family, or
- we need a second confirmation proof for that same family

This keeps “confirmed proof” consistent while still avoiding repo-selection churn later.
