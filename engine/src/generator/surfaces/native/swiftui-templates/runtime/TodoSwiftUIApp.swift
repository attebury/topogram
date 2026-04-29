import SwiftUI

@main
struct TodoSwiftUIApp: App {
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
                    ProgressView("Loading Topogram Todo…")
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
    @Published var contract: TodoUiContract?
    @Published var client: TodoAPIClient?
    @Published var error: String?

    func bootstrap() async {
        do {
            let uiData = try TodoUiContract.loadBundled()
            let apiData = try TodoAPIClient.loadBundledContracts()
            let ui = try TodoUiContract(data: uiData)
            let cli = try TodoAPIClient(contractsData: apiData)
            contract = ui
            client = cli
        } catch {
            self.error = String(describing: error)
        }
    }
}
