import SwiftUI

@main
struct TopogramSwiftUIApp: App {
    @StateObject private var contractHolder = ContractHolder()

    var body: some Scene {
        WindowGroup {
            Group {
                if let contract = contractHolder.contract, let client = contractHolder.client {
                    RootTabView(contract: contract, client: client)
                } else if let err = contractHolder.error {
                    Text("Failed to load Topogram UI contract: \(err)")
                        .padding()
                } else {
                    ProgressView("Loading Topogram UI…")
                }
            }
            .task {
                await contractHolder.bootstrap()
            }
        }
    }
}

@MainActor
final class ContractHolder: ObservableObject {
    @Published var contract: TopogramUiContract?
    @Published var client: TopogramAPIClient?
    @Published var error: String?

    func bootstrap() async {
        do {
            let uiData = try TopogramUiContract.loadBundled()
            let apiData = try TopogramAPIClient.loadBundledContracts()
            let ui = try TopogramUiContract(data: uiData)
            let cli = try TopogramAPIClient(contractsData: apiData)
            contract = ui
            client = cli
        } catch {
            self.error = String(describing: error)
        }
    }
}
