import SwiftUI

struct AppCommands: Commands {
    var body: some Commands {
        CommandGroup(after: .newItem) {
            Button("Open PDF…") {
                (NSApp.delegate as? AppDelegate)?.openPDFPanel()
            }
            .keyboardShortcut("o", modifiers: [.command])
        }
    }
}
