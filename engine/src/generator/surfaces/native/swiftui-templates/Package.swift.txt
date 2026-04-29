// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "TodoSwiftUIApp",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .executable(name: "TodoSwiftUIApp", targets: ["TodoSwiftUIApp"])
    ],
    targets: [
        .executableTarget(
            name: "TodoSwiftUIApp",
            path: "Sources/TodoSwiftUIApp",
            resources: [
                .copy("Resources/api-contracts.json"),
                .copy("Resources/ui-web-contract.json")
            ]
        )
    ]
)
