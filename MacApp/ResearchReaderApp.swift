import SwiftUI

@main
struct ResearchReaderApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

    var body: some Scene {
        WindowGroup("Research Reader", id: "main") {
            ContentView(appDelegate: appDelegate)
        }
        .defaultSize(width: 1440, height: 900)
        .commands {
            AppCommands()
        }

        Settings {
            NativeSettingsView()
        }
    }
}

private struct NativeSettingsView: View {
    var body: some View {
        Form {
            Section("Application") {
                LabeledContent("Runtime", value: "Native macOS app")
                LabeledContent("Web engine", value: "WKWebView")
                LabeledContent("Storage", value: "Local WebKit data store")
            }
            Section("Reader") {
                Text("PDFs and knowledge remain on this Mac. Use File → Open PDF… or ⌘O to import a document.")
                    .foregroundStyle(.secondary)
            }
        }
        .formStyle(.grouped)
        .frame(width: 420)
        .padding()
    }
}
