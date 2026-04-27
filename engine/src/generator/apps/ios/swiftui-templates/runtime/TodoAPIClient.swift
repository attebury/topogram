import Foundation

/// Dynamic capability client mirroring `src/lib/api/client.ts` (requestCapability over bundled api-contracts.json).
public final class TodoAPIClient: @unchecked Sendable {
    private let session: URLSession
    let contracts: [String: Any]
    public init(session: URLSession = .shared, contractsData: Data) throws {
        self.session = session
        guard let root = try JSONSerialization.jsonObject(with: contractsData) as? [String: Any] else {
            throw TodoAPIError.invalidContracts
        }
        self.contracts = root
    }

    public static func loadBundledContracts() throws -> Data {
        guard let url = Bundle.module.url(forResource: "api-contracts", withExtension: "json"),
              let data = try? Data(contentsOf: url) else {
            throw TodoAPIError.missingResource("api-contracts.json")
        }
        return data
    }

    private func apiBase() -> String {
        let env = ProcessInfo.processInfo.environment
        return env["PUBLIC_TOPOGRAM_API_BASE_URL"] ?? "http://localhost:3000"
    }

    private func authToken() -> String {
        ProcessInfo.processInfo.environment["PUBLIC_TOPOGRAM_DEMO_AUTH_TOKEN"] ?? ""
    }

    private func buildPath(contract: [String: Any], input: [String: Any]) throws -> String {
        guard let endpoint = contract["endpoint"] as? [String: Any],
              let rawPath = endpoint["path"] as? String else {
            throw TodoAPIError.invalidContracts
        }
        var path = rawPath
        let requestContract = contract["requestContract"] as? [String: Any]
        let transport = requestContract?["transport"] as? [String: Any]
        let pathFields = transport?["path"] as? [[String: Any]] ?? []
        for field in pathFields {
            guard let name = field["name"] as? String else { continue }
            let wire = (field["transport"] as? [String: Any])?["wireName"] as? String ?? name
            let raw = input[name]
            path = path.replacingOccurrences(of: ":\(wire)", with: encodePathSegment(raw))
        }
        var query: [String] = []
        let queryFields = transport?["query"] as? [[String: Any]] ?? []
        for field in queryFields {
            guard let name = field["name"] as? String else { continue }
            let wire = (field["transport"] as? [String: Any])?["wireName"] as? String ?? name
            if let raw = input[name] {
                if raw is NSNull { continue }
                let s = String(describing: raw)
                if !s.isEmpty {
                    query.append("\(wire)=\(encodeQueryComponent(s))")
                }
            }
        }
        if !query.isEmpty {
            path += "?" + query.joined(separator: "&")
        }
        return path
    }

    private func encodePathSegment(_ value: Any?) -> String {
        let s = value.map { String(describing: $0) } ?? ""
        return s.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? s
    }

    private func encodeQueryComponent(_ value: String) -> String {
        value.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? value
    }

    public func requestCapability(
        _ capabilityId: String,
        input: [String: Any] = [:],
        extraHeaders: [String: String] = [:]
    ) async throws -> Any {
        guard let contract = contracts[capabilityId] as? [String: Any] else {
            throw TodoAPIError.unknownCapability(capabilityId)
        }
        guard let endpoint = contract["endpoint"] as? [String: Any],
              let method = endpoint["method"] as? String else {
            throw TodoAPIError.invalidContracts
        }
        let path = try buildPath(contract: contract, input: input)
        guard let url = URL(string: path, relativeTo: URL(string: apiBase()))?.absoluteURL else {
            throw TodoAPIError.badURL(path)
        }
        var request = URLRequest(url: url)
        request.httpMethod = method

        var headers = extraHeaders
        let authz = endpoint["authz"] as? [[String: Any]] ?? []
        if !authz.isEmpty, !authToken().isEmpty {
            if headers["Authorization"] == nil {
                headers["Authorization"] = "Bearer " + authToken()
            }
        }
        for (k, v) in headers {
            request.setValue(v, forHTTPHeaderField: k)
        }

        let requestContract = contract["requestContract"] as? [String: Any]
        let transport = requestContract?["transport"] as? [String: Any]
        let bodyFields = transport?["body"] as? [[String: Any]] ?? []
        if !bodyFields.isEmpty {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            var payload: [String: Any] = [:]
            for field in bodyFields {
                guard let name = field["name"] as? String else { continue }
                let wire = (field["transport"] as? [String: Any])?["wireName"] as? String ?? name
                if let v = input[name] {
                    payload[wire] = v
                }
            }
            request.httpBody = try JSONSerialization.data(withJSONObject: payload)
        }

        let downloadable = endpoint["download"] as? [[String: Any]] ?? []
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw TodoAPIError.invalidResponse
        }
        guard (200 ..< 300).contains(http.statusCode) else {
            let text = String(data: data, encoding: .utf8) ?? ""
            throw TodoAPIError.http(http.statusCode, text)
        }
        if http.statusCode == 204 {
            return NSNull()
        }
        if !downloadable.isEmpty {
            return data
        }
        return try JSONSerialization.jsonObject(with: data)
    }

    public func extractRows(from json: Any) -> [[String: Any]] {
        if let rows = json as? [[String: Any]] { return rows }
        if let dict = json as? [String: Any] {
            if let items = dict["items"] as? [[String: Any]] { return items }
            if let data = dict["data"] as? [[String: Any]] { return data }
        }
        return []
    }
}

public enum TodoAPIError: Error {
    case invalidContracts
    case missingResource(String)
    case unknownCapability(String)
    case badURL(String)
    case invalidResponse
    case http(Int, String)
}
