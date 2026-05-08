import SwiftUI

/// Holds decoded ui-surface-contract.json for runtime-driven navigation (parity with web bundle).
public final class TopogramUiContract: ObservableObject {
    public let raw: [String: Any]

    public init(data: Data) throws {
        guard let obj = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw NSError(domain: "TopogramUiContract", code: 1)
        }
        self.raw = obj
    }

    public static func loadBundled() throws -> Data {
        guard let url = Bundle.module.url(forResource: "ui-surface-contract", withExtension: "json"),
              let data = try? Data(contentsOf: url) else {
            throw NSError(domain: "TopogramUiContract", code: 2, userInfo: [NSLocalizedDescriptionKey: "Missing ui-surface-contract.json"])
        }
        return data
    }

    public var screens: [[String: Any]] {
        (raw["screens"] as? [[String: Any]]) ?? []
    }

    public func screen(id: String) -> [String: Any]? {
        screens.first { ($0["id"] as? String) == id }
    }

    public func firstScreen(kind: String, excluding excludedId: String? = nil) -> [String: Any]? {
        screens.first {
            ($0["kind"] as? String) == kind && ($0["id"] as? String) != excludedId
        }
    }

    public var tabItems: [NavigationItem] {
        guard let nav = raw["navigation"] as? [String: Any],
              let items = nav["items"] as? [[String: Any]] else {
            return []
        }
        return items.compactMap(NavigationItem.init(json:))
            .filter { $0.visible && $0.pattern == "bottom_tabs" }
            .sorted {
                let o0 = Int($0.order ?? "") ?? 0
                let o1 = Int($1.order ?? "") ?? 0
                return o0 < o1
            }
    }
}

public struct NavigationItem: Identifiable {
    public var id: String { screenId }
    public let screenId: String
    public let route: String?
    public let label: String
    public let visible: Bool
    public let pattern: String?
    public let order: String?

    init?(json: [String: Any]) {
        guard let screenId = json["screenId"] as? String else { return nil }
        self.screenId = screenId
        self.route = json["route"] as? String
        self.label = json["label"] as? String ?? screenId
        self.visible = (json["visible"] as? Bool) ?? false
        self.pattern = json["pattern"] as? String
        self.order = json["order"] as? String
    }
}

public struct RootTabView: View {
    @ObservedObject var contract: TopogramUiContract
    let client: TopogramAPIClient

    public init(contract: TopogramUiContract, client: TopogramAPIClient) {
        self.contract = contract
        self.client = client
    }

    public var body: some View {
        let tabs = contract.tabItems
        TabView {
            ForEach(tabs) { item in
                NavigationStack {
                    DynamicScreenView(contract: contract, client: client, rootScreenId: item.screenId)
                }
                .tabItem { Text(item.label) }
            }
        }
    }
}

public struct DynamicScreenView: View {
    @ObservedObject var contract: TopogramUiContract
    let client: TopogramAPIClient
    let rootScreenId: String

    public init(contract: TopogramUiContract, client: TopogramAPIClient, rootScreenId: String) {
        self.contract = contract
        self.client = client
        self.rootScreenId = rootScreenId
    }

    public var body: some View {
        if let screen = contract.screen(id: rootScreenId) {
            ScreenSwitcher(contract: contract, client: client, screen: screen, baseParams: [:])
        } else {
            Text("Unknown screen: \(rootScreenId)")
        }
    }
}

struct ScreenSwitcher: View {
    @ObservedObject var contract: TopogramUiContract
    let client: TopogramAPIClient
    let screen: [String: Any]
    let baseParams: [String: String]

    var body: some View {
        let kind = screen["kind"] as? String ?? "list"
        Group {
            switch kind {
            case "list":
                ListScreen(contract: contract, client: client, screen: screen, baseParams: baseParams)
            case "detail":
                DetailScreen(contract: contract, client: client, screen: screen, params: baseParams)
            case "form", "wizard":
                FormScreen(client: client, contract: contract, screen: screen, params: baseParams)
            case "board":
                BoardScreen(contract: contract, client: client, screen: screen, baseParams: baseParams)
            case "calendar":
                CalendarScreen(contract: contract, client: client, screen: screen, baseParams: baseParams)
            case "job_status":
                JobStatusScreen(client: client, contract: contract, screen: screen, params: baseParams)
            default:
                Text("Unsupported kind: \(kind)")
            }
        }
    }
}

// MARK: - List

struct ListScreen: View {
    @ObservedObject var contract: TopogramUiContract
    let client: TopogramAPIClient
    let screen: [String: Any]
    let baseParams: [String: String]
    @State private var rows: [[String: Any]] = []
    @State private var errorText: String?
    @State private var filters: [String: String] = [:]

    var body: some View {
        let title = screen["title"] as? String ?? "List"
        let loadCap = (screen["loadCapability"] as? [String: Any])?["id"] as? String
        let screenId = screen["id"] as? String ?? ""
        let filterFields = loadCap.map { client.queryFieldNames(for: $0) } ?? []

        VStack(alignment: .leading, spacing: 8) {
            if let loadCap, !filterFields.isEmpty {
                filterBar(loadCap: loadCap, fields: filterFields)
            }
            if let errorText {
                Text(errorText).foregroundStyle(.red)
            } else if rows.isEmpty {
                Text((screen["emptyState"] as? [String: Any])?["title"] as? String ?? "Empty")
            } else {
                List(0 ..< rows.count, id: \.self) { i in
                    let row = rows[i]
                    NavigationLink {
                        linkedDetail(row: row)
                    } label: {
                        VStack(alignment: .leading) {
                            Text(rowTitle(row))
                                .font(.headline)
                            Text(rowSubtitle(row))
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
        .navigationTitle(title)
        .toolbar {
            if let primary = (screen["actions"] as? [String: Any])?["primary"] as? [String: Any],
               let pid = primary["id"] as? String,
               Visibility.canShowAction(pid, screen: screen, resource: nil) {
                ToolbarItem(placement: .primaryAction) {
                    NavigationLink("Add") {
                        linkedCreate(currentScreenId: screenId)
                    }
                }
            }
        }
        .task {
            if let loadCap {
                await reload(loadCap: loadCap)
            }
        }
    }

    @ViewBuilder
    private func filterBar(loadCap: String, fields: [String]) -> some View {
        VStack(alignment: .leading) {
            Text("Filters").font(.caption).foregroundStyle(.secondary)
            HStack {
                ForEach(fields, id: \.self) { field in
                    TextField(field, text: bindingFilter(field))
                }
            }
            .textFieldStyle(.roundedBorder)
            Button("Apply") {
                Task {
                    await reload(loadCap: loadCap)
                }
            }
        }
        .padding(.horizontal)
    }

    private func bindingFilter(_ key: String) -> Binding<String> {
        Binding(
            get: { filters[key] ?? "" },
            set: { filters[key] = $0 }
        )
    }

    @MainActor
    private func reload(loadCap: String) async {
        errorText = nil
        do {
            let input = baseParams.merging(filters) { _, new in new }
            let json = try await client.requestCapability(loadCap, input: input)
            rows = client.extractRows(from: json)
        } catch {
            errorText = String(describing: error)
        }
    }

    @ViewBuilder
    private func linkedDetail(row: [String: Any]) -> some View {
        if let detail = contract.firstScreen(kind: "detail") {
            DetailScreen(contract: contract, client: client, screen: detail, params: navigationParams(for: detail, row: row, client: client))
        } else {
            RowDetailFallback(row: row)
        }
    }

    @ViewBuilder
    private func linkedCreate(currentScreenId: String) -> some View {
        if let form = contract.firstScreen(kind: "form", excluding: currentScreenId) ?? contract.firstScreen(kind: "wizard", excluding: currentScreenId) {
            FormScreen(client: client, contract: contract, screen: form, params: [:])
        } else {
            Text("Create")
        }
    }
}

private func rowTitle(_ row: [String: Any]) -> String {
    (row["title"] as? String)
        ?? (row["name"] as? String)
        ?? (row["display_name"] as? String)
        ?? ((row["id"] as? String) ?? "row")
}

private func rowSubtitle(_ row: [String: Any]) -> String {
    (row["status"] as? String) ?? ""
}

// MARK: - Detail

struct DetailScreen: View {
    @ObservedObject var contract: TopogramUiContract
    let client: TopogramAPIClient
    let screen: [String: Any]
    let params: [String: String]
    @State private var payload: [String: Any]?
    @State private var errorText: String?

    var body: some View {
        Group {
            if let errorText {
                Text(errorText).foregroundStyle(.red)
            } else if let payload {
                ScrollView {
                    VStack(alignment: .leading, spacing: 8) {
                        ForEach(Array(payload.keys.sorted()), id: \.self) { key in
                            HStack {
                                Text(key).font(.caption).foregroundStyle(.secondary)
                                Spacer()
                                Text(String(describing: payload[key] ?? ""))
                                    .textSelection(.enabled)
                            }
                        }
                    }
                    .padding()
                }
            } else {
                ProgressView()
            }
        }
        .navigationTitle((screen["title"] as? String) ?? "Detail")
        .toolbar {
            ToolbarItemGroup(placement: .automatic) {
                if let primary = (screen["actions"] as? [String: Any])?["primary"] as? [String: Any],
                   let cid = primary["id"] as? String {
                    NavigationLink("Edit") {
                        editForm(cid: cid)
                    }
                }
                if let secondary = (screen["actions"] as? [String: Any])?["secondary"] as? [String: Any],
                   let cid = secondary["id"] as? String {
                    Button("Complete") {
                        Task { await runSecondary(cid) }
                    }
                }
                if let destructive = (screen["actions"] as? [String: Any])?["destructive"] as? [String: Any],
                   let cid = destructive["id"] as? String {
                    Button("Delete", role: .destructive) {
                        Task { await runDestructive(cid) }
                    }
                }
            }
        }
        .task {
            await load()
        }
    }

    private func loadCapId() -> String? {
        (screen["loadCapability"] as? [String: Any])?["id"] as? String
    }

    @MainActor
    private func load() async {
        guard let cap = loadCapId() else { return }
        do {
            let json = try await client.requestCapability(cap, input: params)
            payload = json as? [String: Any]
        } catch {
            errorText = String(describing: error)
        }
    }

    @MainActor
    private func runSecondary(_ capabilityId: String) async {
        var headers: [String: String] = [:]
        if let detail = payload, let updatedAt = detail["updated_at"] {
            headers["If-Match"] = String(describing: updatedAt)
        }
        do {
            _ = try await client.requestCapability(capabilityId, input: params, extraHeaders: headers)
            await load()
        } catch {
            errorText = String(describing: error)
        }
    }

    @MainActor
    private func runDestructive(_ capabilityId: String) async {
        do {
            _ = try await client.requestCapability(capabilityId, input: params)
        } catch {
            errorText = String(describing: error)
        }
    }

    @ViewBuilder
    private func editForm(cid: String) -> some View {
        if let form = contract.screens.first(where: { screen in
            guard let submit = (screen["submitCapability"] as? [String: Any])?["id"] as? String else { return false }
            return submit == cid
        }) ?? contract.firstScreen(kind: "form") {
            FormScreen(client: client, contract: contract, screen: form, params: params)
        } else {
            Text("Edit")
        }
    }
}

// MARK: - Form

struct FormScreen: View {
    let client: TopogramAPIClient
    @ObservedObject var contract: TopogramUiContract
    let screen: [String: Any]
    let params: [String: String]
    @State private var values: [String: String] = [:]
    @State private var message: String?

    var body: some View {
        Form {
            ForEach(formFieldNames(), id: \.self) { name in
                TextField(name, text: binding(name))
            }
            Button("Submit") {
                Task { await submit() }
            }
            if let message {
                Text(message)
            }
        }
        .navigationTitle((screen["title"] as? String) ?? "Form")
        .task {
            await preload()
        }
    }

    private func formFieldNames() -> [String] {
        guard let submitId = (screen["submitCapability"] as? [String: Any])?["id"] as? String else { return [] }
        return client.bodyFieldNames(for: submitId)
    }

    private func binding(_ name: String) -> Binding<String> {
        Binding(
            get: { values[name] ?? "" },
            set: { values[name] = $0 }
        )
    }

    private func preload() async {
        guard let loadCap = (screen["loadCapability"] as? [String: Any])?["id"] as? String else { return }
        do {
            let json = try await client.requestCapability(loadCap, input: params)
            if let dict = json as? [String: Any] {
                for key in dict.keys {
                    values[key] = String(describing: dict[key] ?? "")
                }
            }
        } catch {
            message = String(describing: error)
        }
    }

    private func submit() async {
        guard let submitId = (screen["submitCapability"] as? [String: Any])?["id"] as? String else { return }
        var input: [String: Any] = [:]
        for name in formFieldNames() {
            if let v = values[name], !v.isEmpty {
                input[name] = v
            }
        }
        for (k, v) in params where input[k] == nil {
            input[k] = v
        }
        var headers: [String: String] = [:]
        if let etag = values["updated_at"], !etag.isEmpty {
            headers["If-Match"] = etag
        }
        do {
            _ = try await client.requestCapability(submitId, input: input, extraHeaders: headers)
            message = "Saved"
        } catch {
            message = String(describing: error)
        }
    }
}

// MARK: - Board & Calendar

struct BoardScreen: View {
    @ObservedObject var contract: TopogramUiContract
    let client: TopogramAPIClient
    let screen: [String: Any]
    let baseParams: [String: String]
    @State private var rows: [[String: Any]] = []

    private var grouped: [String: [[String: Any]]] {
        Dictionary(grouping: rows, by: { ($0["status"] as? String) ?? "unknown" })
    }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading) {
                ForEach(Array(grouped.keys.sorted()), id: \.self) { key in
                    Text(key).font(.headline)
                    ForEach(Array((grouped[key] ?? []).enumerated()), id: \.offset) { _, row in
                        NavigationLink {
                            DetailScreen(
                                contract: contract,
                                client: client,
                                screen: contract.firstScreen(kind: "detail") ?? [:],
                                params: navigationParams(for: contract.firstScreen(kind: "detail") ?? [:], row: row, client: client)
                            )
                        } label: {
                            Text(rowTitle(row))
                        }
                    }
                }
            }
            .padding()
        }
        .navigationTitle(screen["title"] as? String ?? "Board")
        .task {
            await load()
        }
    }

    private func load() async {
        guard let cap = (screen["loadCapability"] as? [String: Any])?["id"] as? String else { return }
        do {
            let json = try await client.requestCapability(cap, input: baseParams)
            rows = client.extractRows(from: json)
        } catch {
            rows = []
        }
    }
}

struct CalendarScreen: View {
    @ObservedObject var contract: TopogramUiContract
    let client: TopogramAPIClient
    let screen: [String: Any]
    let baseParams: [String: String]
    @State private var rows: [[String: Any]] = []

    private var grouped: [String: [[String: Any]]] {
        Dictionary(grouping: rows, by: { row in
            if let d = row["due_date"] as? String {
                return String(d.prefix(10))
            }
            return "unscheduled"
        })
    }

    var body: some View {
        List {
            ForEach(Array(grouped.keys.sorted()), id: \.self) { day in
                Section(day) {
                    ForEach(Array((grouped[day] ?? []).enumerated()), id: \.offset) { _, row in
                        NavigationLink {
                            DetailScreen(
                                contract: contract,
                                client: client,
                                screen: contract.firstScreen(kind: "detail") ?? [:],
                                params: navigationParams(for: contract.firstScreen(kind: "detail") ?? [:], row: row, client: client)
                            )
                        } label: {
                            Text(rowTitle(row))
                        }
                    }
                }
            }
        }
        .navigationTitle(screen["title"] as? String ?? "Calendar")
        .task {
            await load()
        }
    }

    private func load() async {
        guard let cap = (screen["loadCapability"] as? [String: Any])?["id"] as? String else { return }
        do {
            let json = try await client.requestCapability(cap, input: baseParams)
            rows = client.extractRows(from: json)
        } catch {
            rows = []
        }
    }
}

struct JobStatusScreen: View {
    let client: TopogramAPIClient
    @ObservedObject var contract: TopogramUiContract
    let screen: [String: Any]
    let params: [String: String]
    @State private var job: [String: Any]?

    var body: some View {
        Group {
            if let job {
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(Array(job.keys.sorted()), id: \.self) { k in
                        Text("\(k): \(String(describing: job[k] ?? ""))")
                    }
                    if let terminal = (screen["actions"] as? [String: Any])?["terminal"] as? [String: Any],
                       let cid = terminal["id"] as? String {
                        Button("Download") {
                            Task { await download(cid) }
                        }
                    }
                }
                .padding()
            } else {
                ProgressView()
            }
        }
        .navigationTitle((screen["title"] as? String) ?? "Export")
        .task {
            await loadJob()
        }
    }

    private func loadJob() async {
        guard let cap = (screen["loadCapability"] as? [String: Any])?["id"] as? String else { return }
        do {
            let json = try await client.requestCapability(cap, input: params)
            job = json as? [String: Any]
        } catch {
            job = [:]
        }
    }

    private func download(_ capabilityId: String) async {
        do {
            _ = try await client.requestCapability(capabilityId, input: params)
        } catch {
            // ignore download errors in stub
        }
    }
}

struct RowDetailFallback: View {
    let row: [String: Any]

    var body: some View {
        List(Array(row.keys.sorted()), id: \.self) { key in
            HStack {
                Text(key).foregroundStyle(.secondary)
                Spacer()
                Text(String(describing: row[key] ?? ""))
            }
        }
        .navigationTitle(rowTitle(row))
    }
}

private func navigationParams(for screen: [String: Any], row: [String: Any], client: TopogramAPIClient) -> [String: String] {
    guard let cap = (screen["loadCapability"] as? [String: Any])?["id"] as? String else {
        return row.compactMapValues { $0 as? String }
    }
    let pathFields = client.pathFieldNames(for: cap)
    if pathFields.isEmpty {
        return row.compactMapValues { $0 as? String }
    }
    var params: [String: String] = [:]
    let fallbackId = row["id"].map { String(describing: $0) } ?? ""
    for field in pathFields {
        if let value = row[field] {
            params[field] = String(describing: value)
        } else if !fallbackId.isEmpty {
            params[field] = fallbackId
        }
    }
    return params
}
