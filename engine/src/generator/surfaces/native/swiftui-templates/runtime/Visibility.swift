import Foundation

/// Port of web `visibility.ts` predicates used by dynamic screens.
public enum Visibility {
    public struct Rule {
        public let predicate: String?
        public let value: String?
        public let claimValue: String?
        public let ownershipField: String?
        public let capabilityId: String?
    }

    public struct PrincipalOverride {
        public var userId: String?
        public var permissions: [String]?
        public var roles: [String]?
        public var claims: [String: Any]?
        public var isAdmin: Bool?
    }

    public static func canShow(
        rule: Rule?,
        resource: [String: Any]?,
        overrides: PrincipalOverride? = nil
    ) -> Bool {
        guard let rule else { return true }
        guard let principal = currentPrincipal(overrides: overrides) else { return true }

        switch rule.predicate {
        case "permission":
            guard let value = rule.value else { return true }
            return principal.permissions.contains("*") || principal.permissions.contains(value)
        case "ownership":
            guard let value = rule.value else { return true }
            if value == "none" { return true }
            if value == "owner_or_admin", principal.isAdmin { return true }
            let owner = ownerId(from: resource, field: rule.ownershipField)
            return owner == principal.userId
        case "claim":
            let claim = rule.value
            let expected = rule.claimValue
            guard let claim else { return true }
            let raw = principal.claims[claim]
            if expected == nil || expected?.isEmpty == true {
                if raw == nil { return false }
                if let b = raw as? Bool { return b }
                if let s = raw as? String { return !s.isEmpty }
                return true
            }
            return String(describing: raw ?? "") == expected
        default:
            return true
        }
    }

    private static func env(_ key: String) -> String {
        ProcessInfo.processInfo.environment[key] ?? ""
    }

    private static func csv(_ raw: String) -> [String] {
        raw.split(separator: ",").map { String($0).trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
    }

    private static func parseClaims(_ raw: String) -> [String: Any] {
        guard let data = raw.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data),
              let dict = obj as? [String: Any] else {
            return [:]
        }
        return dict
    }

    private static func decodeJwtPayload(_ token: String) -> [String: Any]? {
        let parts = token.split(separator: ".")
        guard parts.count > 1 else { return nil }
        var body = String(parts[1])
        body = body.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        let pad = 4 - body.count % 4
        if pad < 4 { body += String(repeating: "=", count: pad) }
        guard let data = Data(base64Encoded: body),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return nil
        }
        return json
    }

    private static func principalFromJwt(_ token: String) -> Principal? {
        guard let payload = decodeJwtPayload(token) else { return nil }
        let sub = payload["sub"] as? String ?? ""
        let permissions = Set((payload["permissions"] as? [String]) ?? [])
        let roles = Set((payload["roles"] as? [String]) ?? [])
        let admin = payload["admin"] as? Bool ?? false
        return Principal(
            userId: sub,
            permissions: permissions,
            roles: roles,
            claims: payload,
            isAdmin: admin
        )
    }

    private struct Principal {
        let userId: String
        let permissions: Set<String>
        let roles: Set<String>
        let claims: [String: Any]
        let isAdmin: Bool
    }

    private static func currentPrincipal(overrides: PrincipalOverride?) -> Principal? {
        let token = env("PUBLIC_TOPOGRAM_AUTH_TOKEN")
        let jwtPrincipal = token.isEmpty ? nil : principalFromJwt(token)
        let envClaims = parseClaims(env("PUBLIC_TOPOGRAM_AUTH_CLAIMS"))
        let envUserId = env("PUBLIC_TOPOGRAM_AUTH_USER_ID")
        let userId = overrides?.userId
            ?? (!envUserId.isEmpty ? envUserId : nil)
            ?? jwtPrincipal?.userId
            ?? ""

        var permissions = Set(csv(env("PUBLIC_TOPOGRAM_AUTH_PERMISSIONS")))
        permissions.formUnion(jwtPrincipal?.permissions ?? [])
        permissions.formUnion(overrides?.permissions ?? [])

        var roles = Set(csv(env("PUBLIC_TOPOGRAM_AUTH_ROLES")))
        if roles.isEmpty { roles = Set(csv(env("PUBLIC_TOPOGRAM_AUTH_ROLE"))) }
        roles.formUnion(jwtPrincipal?.roles ?? [])
        roles.formUnion(overrides?.roles ?? [])

        let adminFlag =
            (overrides?.isAdmin ?? false)
                || env("PUBLIC_TOPOGRAM_AUTH_ADMIN").lowercased() == "true"
                || jwtPrincipal?.isAdmin == true

        var claims = jwtPrincipal?.claims ?? [:]
        claims.merge(envClaims) { _, new in new }
        if let o = overrides?.claims { claims.merge(o) { _, new in new } }

        if token.isEmpty && userId.isEmpty && permissions.isEmpty && roles.isEmpty && claims.isEmpty && !adminFlag {
            return nil
        }

        return Principal(
            userId: userId,
            permissions: permissions,
            roles: roles,
            claims: claims,
            isAdmin: adminFlag
        )
    }

    private static func ownerId(from resource: [String: Any]?, field: String?) -> String {
        guard let resource else { return "" }
        if let field {
            if let v = resource[field] as? String { return v }
        }
        for key in ["owner_id", "assignee_id", "author_id", "user_id", "created_by_user_id"] {
            if let v = resource[key] as? String { return v }
        }
        return ""
    }

    public static func visibilityRules(from screen: [String: Any]) -> [Rule] {
        guard let raw = screen["visibility"] as? [[String: Any]] else { return [] }
        return raw.map { entry in
            let cap = entry["capability"] as? [String: Any]
            return Rule(
                predicate: entry["predicate"] as? String,
                value: entry["value"] as? String,
                claimValue: entry["claimValue"] as? String,
                ownershipField: entry["ownershipField"] as? String,
                capabilityId: cap?["id"] as? String
            )
        }
    }

    public static func canShowAction(_ capabilityId: String?, screen: [String: Any], resource: [String: Any]?) -> Bool {
        guard let capabilityId else { return true }
        let rules = visibilityRules(from: screen).filter { $0.capabilityId == capabilityId }
        for rule in rules {
            if !canShow(rule: rule, resource: resource) { return false }
        }
        return true
    }
}
